// @vitest-environment node
import { expect, test } from 'vite-plus/test'
import { parseRequestTarget } from './request-target.js'

test('request target dispatch is exact and single-decode', () => {
  expect(parseRequestTarget('/api/user')).toEqual({ kind: 'api-user', pathname: '/api/user' })
  expect(parseRequestTarget('/api/user?x=1')).toEqual({ kind: 'bad-request' })
  for (const target of ['/api/unknown', '/api%2Fuser', '/%61pi/user', '/api%252Fuser', '/apiary']) {
    expect(parseRequestTarget(target)).toEqual({
      kind: 'reserved-api',
      pathname: expect.any(String)
    })
  }
  expect(parseRequestTarget('/dashboard?x=1')).toEqual({ kind: 'static', pathname: '/dashboard' })
})

test('request target rejects traversal, malformed encoding, and protocol-relative values', () => {
  for (const target of [
    '//evil.test/a.js',
    '/%2e%2e/secrets.env',
    '/assets/..%2f..%2fsecret',
    '/a%ZZ',
    '/a%00.js',
    '/a%5Cb'
  ]) {
    expect(parseRequestTarget(target)).toEqual({ kind: 'bad-request' })
  }
})
