import { expect, test } from 'vite-plus/test'
import { fetchUsers, type UserLoadResult } from './api-client'

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
} satisfies Extract<UserLoadResult, { ok: true }>['body']

test('clientLoader fetches the same-origin endpoint exactly once', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  let requestInit: RequestInit | undefined
  globalThis.fetch = async (_input, init) => {
    calls += 1
    requestInit = init
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const result = await fetchUsers()
    expect(calls).toBe(1)
    expect(requestInit?.credentials).toBe('include')
    expect(requestInit?.cache).toBe('no-store')
    expect(result).toEqual({ ok: true, body: responseBody })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('non-success response becomes a sanitized authentication failure', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    return new Response('upstream secret details', {
      status: 401,
      headers: { 'content-type': 'text/plain' }
    })
  }

  try {
    await expect(fetchUsers()).resolves.toEqual({
      ok: false,
      status: 401,
      body: 'Not authenticated'
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
