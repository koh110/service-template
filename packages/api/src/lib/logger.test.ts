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
    meta: { method: 'GET', path: '/api/user', status: 200, duration: 3 }
  })

  expect(logMock).toHaveBeenCalledTimes(1)
  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      level: 'INFO',
      label: 'access',
      requestId: 'request-id-1',
      body: 'GET /api/user',
      meta: { method: 'GET', path: '/api/user', status: 200, duration: 3 }
    })
  )
})

test('logger meta is a closed event schema at compile time', () => {
  const logMock = spyOnConsole('log')

  // @ts-expect-error LogEvents に無い label は meta を持てない
  logger.log({ label: 'unknown-label', body: 'x', meta: { status: 200 } })

  // @ts-expect-error 既知 label でも schema に無い field は渡せない
  logger.log({ label: 'handleError', body: 'x', meta: { status: 500, authorization: 'Bearer x' } })

  // @ts-expect-error meta の値は primitive のみで nested object は渡せない
  logger.log({ label: 'handleError', body: 'x', meta: { status: { code: 500 } } })

  const payload: Record<string, unknown> = { status: 500 }
  // @ts-expect-error 型の広い payload 変数を meta へ渡せない
  logger.log({ label: 'handleError', body: 'x', meta: payload })

  // @ts-expect-error payload 変数の spread も渡せない
  logger.log({ label: 'handleError', body: 'x', meta: { ...payload } })

  // 上記はいずれも型検査で弾かれることの検証であり、runtime では出力自体は行われる
  expect(logMock).toHaveBeenCalledTimes(5)
})

test('redactMeta remains as a runtime last line of defense', () => {
  const logMock = spyOnConsole('log')

  // wide な型の変数は closed event schema に代入できない(実際に型エラーになる)
  const leaked: Record<string, unknown> = {
    status: 200,
    authorization: 'Bearer super-secret-token',
    provider: { idToken: 'id-token-value' }
  }
  logger.log({
    label: 'handleError',
    body: 'verified',
    // @ts-expect-error 型検査をすり抜けた値が runtime で redact されることを検証する
    meta: leaked
  })

  const [output] = logMock.mock.calls[0]
  expect(output).not.toContain('super-secret-token')
  expect(output).not.toContain('id-token-value')
  expect(JSON.parse(output)).toStrictEqual({
    level: 'INFO',
    label: 'handleError',
    body: 'verified',
    meta: {
      status: 200,
      authorization: REDACTED,
      provider: UNSUPPORTED
    }
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
