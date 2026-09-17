import { expect, test } from 'vite-plus/test'
import { fetchUsers, type UserLoadResult } from './user.client'

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

test('fetchUsers returns the typed success response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    await expect(fetchUsers()).resolves.toEqual({
      ok: true,
      status: 200,
      body: responseBody
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchUsers preserves a typed non-success response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    return new Response('not authenticated', {
      status: 401,
      headers: { 'content-type': 'text/plain' }
    })
  }

  try {
    await expect(fetchUsers()).resolves.toEqual({
      ok: false,
      status: 401,
      body: 'not authenticated'
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
