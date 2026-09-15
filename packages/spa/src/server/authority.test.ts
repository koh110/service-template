// @vitest-environment node
import { expect, test } from 'vite-plus/test'
import { validateAuthority } from './authority.js'

test('authority accepts one exact Host and no Origin', () => {
  expect(
    validateAuthority({
      request: { rawHeaders: ['Host', '127.0.0.1:8789'] },
      authority: '127.0.0.1:8789',
      origin: 'http://127.0.0.1:8789'
    })
  ).toEqual({ ok: true })
})

test('authority rejects missing, duplicate, and comma-joined Host fields', () => {
  for (const rawHeaders of [
    [],
    ['Host', '127.0.0.1:8789', 'Host', '127.0.0.1:8789'],
    ['Host', '127.0.0.1:8789,127.0.0.1:8789'],
    ['Host', '127.0.0.1:8790']
  ]) {
    expect(
      validateAuthority({
        request: { rawHeaders },
        authority: '127.0.0.1:8789',
        origin: 'http://127.0.0.1:8789'
      })
    ).toEqual({ ok: false, status: 400 })
  }
})

test('authority rejects duplicate, comma-joined, and mismatched Origin fields', () => {
  for (const rawHeaders of [
    ['Host', '127.0.0.1:8789', 'Origin', 'http://127.0.0.1:8789', 'Origin', 'http://evil.test'],
    ['Host', '127.0.0.1:8789', 'Origin', 'http://127.0.0.1:8789,http://evil.test'],
    ['Host', '127.0.0.1:8789', 'Origin', 'http://evil.test']
  ]) {
    expect(
      validateAuthority({
        request: { rawHeaders },
        authority: '127.0.0.1:8789',
        origin: 'http://127.0.0.1:8789'
      })
    ).toEqual({ ok: false, status: 403 })
  }
})
