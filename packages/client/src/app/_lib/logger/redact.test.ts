import { expect, test } from 'vite-plus/test'
import { REDACTED, UNSUPPORTED, isSensitiveKey, redactMeta, serializeError } from './redact'

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

test('redactMeta masks values bound to sensitive keys', () => {
  const actual = redactMeta({
    status: 200,
    Authorization: 'Bearer super-secret-token',
    'set-cookie': 'session=abcdef; HttpOnly',
    idToken: 'id-token-value',
    refreshToken: 'refresh-token-value'
  })

  expect(actual).toStrictEqual({
    status: 200,
    Authorization: REDACTED,
    'set-cookie': REDACTED,
    idToken: REDACTED,
    refreshToken: REDACTED
  })
  expect(JSON.stringify(actual)).not.toContain('super-secret-token')
  expect(JSON.stringify(actual)).not.toContain('abcdef')
})

test('redactMeta keeps primitives and replaces non-primitive values', () => {
  const actual = redactMeta({
    name: 'task',
    count: 3,
    ok: true,
    empty: null,
    missing: undefined,
    headers: new Headers({ authorization: 'Bearer super-secret-token' }),
    nested: { userId: 1 },
    list: [1, 2, 3]
  })

  expect(actual).toStrictEqual({
    name: 'task',
    count: 3,
    ok: true,
    empty: null,
    missing: undefined,
    headers: UNSUPPORTED,
    nested: UNSUPPORTED,
    list: UNSUPPORTED
  })
  expect(JSON.stringify(actual)).not.toContain('super-secret-token')
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
