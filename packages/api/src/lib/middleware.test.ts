import { Hono } from 'hono'
import { expect, test, vi } from 'vite-plus/test'
import { accessLogMiddleware, verifyAuthorizationMiddleware } from './middleware.js'
import { handleError } from './wrap.js'

// console の spy は同一ファイル内の test をまたいで呼び出し履歴が蓄積するため、
// test ごとに履歴をクリアしてから使う
function spyOnConsole(method: 'log' | 'error' | 'dir') {
  const spy = vi.spyOn(console, method).mockImplementation(() => {
    return undefined
  })
  spy.mockClear()
  return spy
}

function parseLogs(calls: ReadonlyArray<ReadonlyArray<unknown>>) {
  return calls.map(([output]) => {
    return JSON.parse(`${output}`)
  })
}

test('access log and application log share the same requestId', async () => {
  const logMock = spyOnConsole('log')
  const errorMock = spyOnConsole('error')

  const app = new Hono()
  app.use(accessLogMiddleware())
  app.onError(handleError)
  app.get('/boom', () => {
    throw new Error('boom')
  })

  const res = await app.request('/boom')
  expect(res.status).toBe(500)

  const [accessLog] = parseLogs(logMock.mock.calls)
  const [applicationLog] = parseLogs(errorMock.mock.calls)

  expect(accessLog.label).toBe('access')
  expect(applicationLog.label).toBe('handleError')
  expect(typeof accessLog.requestId).toBe('string')
  expect(applicationLog.requestId).toBe(accessLog.requestId)
})

test('token verification failure is logged with the access log requestId', async () => {
  const logMock = spyOnConsole('log')
  spyOnConsole('dir')

  const app = new Hono()
  app.use(accessLogMiddleware())
  app.use(verifyAuthorizationMiddleware())
  app.onError(handleError)
  app.get('/secure', (c) => {
    return c.text('ok')
  })

  const res = await app.request('/secure', {
    headers: { Authorization: 'Bearer not-a-valid-token' }
  })
  expect(res.status).toBe(401)

  const logs = parseLogs(logMock.mock.calls)
  const accessLog = logs.find((log) => {
    return log.label === 'access'
  })
  const tokenLog = logs.find((log) => {
    return log.label === 'token_verification'
  })

  expect(typeof accessLog?.requestId).toBe('string')
  expect(tokenLog?.requestId).toBe(accessLog?.requestId)
})

test('token verification failure log does not contain the presented token', async () => {
  const logMock = spyOnConsole('log')
  spyOnConsole('dir')

  const app = new Hono()
  app.use(accessLogMiddleware())
  app.use(verifyAuthorizationMiddleware())
  app.onError(handleError)
  app.get('/secure', (c) => {
    return c.text('ok')
  })

  await app.request('/secure', {
    headers: {
      Authorization: 'Bearer super-secret-token',
      Cookie: 'session=abcdef'
    }
  })

  const output = logMock.mock.calls
    .map(([value]) => {
      return `${value}`
    })
    .join('\n')

  expect(output).toContain('token_verification')
  expect(output).not.toContain('super-secret-token')
  expect(output).not.toContain('abcdef')
})

test('access log does not contain request headers', async () => {
  const logMock = spyOnConsole('log')

  const app = new Hono()
  app.use(accessLogMiddleware())
  app.get('/', (c) => {
    return c.text('ok')
  })

  await app.request('/', {
    headers: {
      Authorization: 'Bearer super-secret-token',
      Cookie: 'session=abcdef'
    }
  })

  const [accessLog] = parseLogs(logMock.mock.calls)

  expect(accessLog.meta).toStrictEqual({
    method: 'GET',
    path: '/',
    status: 200,
    duration: expect.any(Number)
  })
})
