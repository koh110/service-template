import { expect, test, vi } from 'vite-plus/test'
import { logger } from './logger.js'
import { REDACTED, UNSUPPORTED } from './redact.js'

vi.mock('console')

// console の spy は同一ファイル内の test をまたいで呼び出し履歴が蓄積するため、
// test ごとに履歴をクリアしてから使う
function spyOnConsole(method: 'log' | 'error') {
  const spy = vi.spyOn(console, method).mockImplementation(() => {
    return undefined
  })
  spy.mockClear()
  return spy
}

test('logger.log outputs level / label / body as a structured log', () => {
  const logMock = spyOnConsole('log')

  logger.log({ label: 'foo', body: 'bar' })

  expect(logMock).toHaveBeenCalledTimes(1)
  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      level: 'INFO',
      label: 'foo',
      body: 'bar'
    })
  )
})

test('logger.log carries requestId as a top level field', () => {
  const logMock = spyOnConsole('log')

  logger.log({
    label: 'access',
    requestId: 'request-id-1',
    body: 'GET /api/user',
    meta: { status: 200 }
  })

  expect(logMock).toHaveBeenCalledTimes(1)
  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      level: 'INFO',
      label: 'access',
      requestId: 'request-id-1',
      body: 'GET /api/user',
      meta: { status: 200 }
    })
  )
})

test('logger.log redacts Authorization / Cookie / token in meta', () => {
  const logMock = spyOnConsole('log')

  logger.log({
    label: 'auth',
    body: 'verified',
    meta: {
      authorization: 'Bearer super-secret-token',
      cookie: 'session=abcdef',
      provider: { idToken: 'id-token-value', userId: 1 }
    }
  })

  const [output] = logMock.mock.calls[0]
  expect(output).not.toContain('super-secret-token')
  expect(output).not.toContain('abcdef')
  expect(output).not.toContain('id-token-value')
  expect(JSON.parse(output)).toStrictEqual({
    level: 'INFO',
    label: 'auth',
    body: 'verified',
    meta: {
      authorization: REDACTED,
      cookie: REDACTED,
      provider: { idToken: REDACTED, userId: 1 }
    }
  })
})

test('logger.log does not expand a Headers passed through meta', () => {
  const logMock = spyOnConsole('log')

  logger.log({
    body: 'request',
    meta: {
      headers: new Headers({ authorization: 'Bearer super-secret-token' })
    }
  })

  const [output] = logMock.mock.calls[0]
  expect(output).not.toContain('super-secret-token')
  expect(JSON.parse(output)).toStrictEqual({
    level: 'INFO',
    body: 'request',
    meta: { headers: UNSUPPORTED }
  })
})

test('logger.error serializes an Error into a limited shape', () => {
  const logMock = spyOnConsole('error')

  logger.error({
    label: 'handleError',
    requestId: 'request-id-1',
    body: 'error',
    error: new Error('boom')
  })

  expect(logMock).toHaveBeenCalledTimes(1)
  const [output] = logMock.mock.calls[0]
  const parsed = JSON.parse(output)
  expect(parsed.level).toBe('ERROR')
  expect(parsed.label).toBe('handleError')
  expect(parsed.requestId).toBe('request-id-1')
  expect(parsed.error.name).toBe('Error')
  expect(parsed.error.message).toBe('boom')
  expect(typeof parsed.error.stack).toBe('string')
})

test('logger.error does not leak enumerable properties of an external error', () => {
  const logMock = spyOnConsole('error')

  class ProviderError extends Error {
    config = { headers: { authorization: 'Bearer super-secret-token' } }
    refreshToken = 'refresh-token-value'
  }

  logger.error({
    label: 'provider',
    body: 'provider call failed',
    error: new ProviderError('provider failed')
  })

  const [output] = logMock.mock.calls[0]
  expect(output).not.toContain('super-secret-token')
  expect(output).not.toContain('refresh-token-value')
  expect(Object.keys(JSON.parse(output).error).sort()).toStrictEqual(['message', 'name', 'stack'])
})

test('logger.error serializes a non-Error value without spreading it', () => {
  const logMock = spyOnConsole('error')

  logger.error({
    label: 'foo',
    body: 'error',
    error: { code: 'auth/invalid-id-token', message: 'invalid', idToken: 'id' }
  })

  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      level: 'ERROR',
      label: 'foo',
      body: 'error',
      error: { name: 'auth/invalid-id-token', message: 'invalid' }
    })
  )
})
