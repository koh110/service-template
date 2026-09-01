import { expect, test } from 'vite-plus/test'
import {
  CIRCULAR,
  DEPTH_LIMIT,
  REDACTED,
  UNSUPPORTED,
  isSensitiveKey,
  redact,
  serializeError
} from './redact.js'

test('isSensitiveKey matches credential-ish keys regardless of case and separators', () => {
  expect(isSensitiveKey('Authorization')).toBe(true)
  expect(isSensitiveKey('cookie')).toBe(true)
  expect(isSensitiveKey('set-cookie')).toBe(true)
  expect(isSensitiveKey('Set-Cookie')).toBe(true)
  expect(isSensitiveKey('password')).toBe(true)
  expect(isSensitiveKey('client_secret')).toBe(true)
  expect(isSensitiveKey('idToken')).toBe(true)
  expect(isSensitiveKey('accessToken')).toBe(true)
  expect(isSensitiveKey('refresh_token')).toBe(true)
  expect(isSensitiveKey('sessionToken')).toBe(true)
  expect(isSensitiveKey('x-api-key')).toBe(true)

  expect(isSensitiveKey('status')).toBe(false)
  expect(isSensitiveKey('requestId')).toBe(false)
  expect(isSensitiveKey('userId')).toBe(false)
})

test('redact masks Authorization / Cookie / token values including nested ones', () => {
  const actual = redact({
    method: 'GET',
    Authorization: 'Bearer super-secret-token',
    cookie: 'session=abcdef',
    session: {
      'set-cookie': 'session=abcdef; HttpOnly',
      idToken: 'id-token-value',
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      userId: 1
    }
  })

  expect(actual).toStrictEqual({
    method: 'GET',
    Authorization: REDACTED,
    cookie: REDACTED,
    session: {
      'set-cookie': REDACTED,
      idToken: REDACTED,
      accessToken: REDACTED,
      refreshToken: REDACTED,
      userId: 1
    }
  })
  expect(JSON.stringify(actual)).not.toContain('super-secret-token')
  expect(JSON.stringify(actual)).not.toContain('abcdef')
})

test('redact does not expand Headers / Request / Response', () => {
  const headers = new Headers({
    authorization: 'Bearer super-secret-token',
    cookie: 'session=abcdef'
  })
  const request = new Request('https://example.com/api/user', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: 'p@ssw0rd' })
  })

  const actual = redact({ headers, request, response: new Response('body') })

  expect(actual).toStrictEqual({
    headers: UNSUPPORTED,
    request: UNSUPPORTED,
    response: UNSUPPORTED
  })
  expect(JSON.stringify(actual)).not.toContain('super-secret-token')
  expect(JSON.stringify(actual)).not.toContain('p@ssw0rd')
})

test('redact does not expand class instances or functions', () => {
  class Provider {
    accessToken = 'access-token-value'
  }

  const actual = redact({
    provider: new Provider(),
    map: new Map([['token', 'token-value']]),
    fn: () => {
      return 'noop'
    }
  })

  expect(actual).toStrictEqual({
    provider: UNSUPPORTED,
    map: UNSUPPORTED,
    fn: UNSUPPORTED
  })
})

test('redact keeps primitives and normalizes Date / BigInt', () => {
  const date = new Date('2026-09-01T00:00:00.000Z')

  expect(
    redact({
      count: 1,
      enabled: true,
      empty: null,
      date,
      big: 10n
    })
  ).toStrictEqual({
    count: 1,
    enabled: true,
    empty: null,
    date: '2026-09-01T00:00:00.000Z',
    big: '10'
  })
})

test('redact walks arrays and truncates long ones', () => {
  expect(redact({ users: [{ password: 'x', name: 'a' }] })).toStrictEqual({
    users: [{ password: REDACTED, name: 'a' }]
  })

  const long = Array.from({ length: 52 }).map((_, i) => {
    return i
  })
  const actual = redact(long)

  expect(Array.isArray(actual) && actual.length).toBe(51)
  expect(Array.isArray(actual) && actual.at(-1)).toBe('[2 more items]')
})

test('redact stops at circular references and depth limit', () => {
  const circular: Record<string, unknown> = { name: 'root' }
  circular.self = circular

  expect(redact(circular)).toStrictEqual({ name: 'root', self: CIRCULAR })

  expect(redact({ a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } })).toStrictEqual({
    a: { b: { c: { d: { e: { f: DEPTH_LIMIT } } } } }
  })
})

test('serializeError keeps only name / message / stack', () => {
  const error = new Error('boom')
  const actual = serializeError(error)

  expect(actual.name).toBe('Error')
  expect(actual.message).toBe('boom')
  expect(typeof actual.stack).toBe('string')
  expect(actual.cause).toBeUndefined()
})

test('serializeError does not leak arbitrary enumerable properties of an error', () => {
  class ProviderError extends Error {
    // external SDK が request 情報を error に詰めてくるケース
    config = {
      headers: { authorization: 'Bearer super-secret-token' },
      body: { password: 'p@ssw0rd' }
    }
    accessToken = 'access-token-value'
  }
  const error = new ProviderError('provider failed')
  error.name = 'ProviderError'

  const actual = serializeError(error)

  expect(actual.name).toBe('ProviderError')
  expect(actual.message).toBe('provider failed')
  expect(Object.keys(actual).sort()).toStrictEqual(['message', 'name', 'stack'])
  expect(JSON.stringify(actual)).not.toContain('super-secret-token')
  expect(JSON.stringify(actual)).not.toContain('access-token-value')
  expect(JSON.stringify(actual)).not.toContain('p@ssw0rd')
})

test('serializeError follows the cause chain within a bounded depth', () => {
  const error = new Error('level0', {
    cause: new Error('level1', {
      cause: new Error('level2', { cause: new Error('level3') })
    })
  })

  const actual = serializeError(error)

  expect(actual.message).toBe('level0')
  expect(actual.cause?.message).toBe('level1')
  expect(actual.cause?.cause?.message).toBe('level2')
  expect(actual.cause?.cause?.cause?.message).toBe('level3')
  expect(actual.cause?.cause?.cause?.cause).toBeUndefined()
})

test('serializeError stops on a circular cause chain', () => {
  const error = new Error('self referencing')
  error.cause = error

  expect(serializeError(error).cause?.cause?.cause?.cause).toBeUndefined()
})

test('serializeError narrows non-Error values to name / message', () => {
  expect(serializeError('boom')).toStrictEqual({
    name: 'NonError',
    message: 'boom'
  })
  expect(serializeError(500)).toStrictEqual({
    name: 'NonError',
    message: '500'
  })
  expect(serializeError(undefined)).toStrictEqual({
    name: 'NonError',
    message: 'undefined'
  })
  // external SDK の plain object error。message / name(なければ code)だけを残す
  expect(
    serializeError({
      code: 'auth/invalid-id-token',
      message: 'invalid token',
      idToken: 'id-token-value',
      headers: { authorization: 'Bearer super-secret-token' }
    })
  ).toStrictEqual({
    name: 'auth/invalid-id-token',
    message: 'invalid token'
  })
})

test('redact converts nested errors through serializeError', () => {
  const actual = redact({ failure: new Error('nested boom') })

  expect(actual).toStrictEqual({
    failure: {
      name: 'Error',
      message: 'nested boom',
      stack: expect.any(String)
    }
  })
})
