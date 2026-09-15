import { expect, test } from 'vite-plus/test'
import { fetchUsers } from './api-client'
import type { UserResponse } from '../../src/api-contract'

const responseBody = {
  count: 1,
  user: [
    {
      id: 1,
      name: 'Alice',
      created_at: 1710000000,
      updated_at: 1710003600
    }
  ]
} satisfies UserResponse

test('clientLoader fetches the same-origin endpoint exactly once', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const result = await fetchUsers()
    expect(calls).toBe(1)
    expect(result).toEqual({ ok: true, body: responseBody })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('invalid response shape becomes a sanitized failure', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ count: 2, user: responseBody.user }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    await expect(fetchUsers()).resolves.toEqual({ ok: false, status: 502, body: 'Bad Gateway' })
  } finally {
    globalThis.fetch = originalFetch
  }
})
