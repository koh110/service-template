import { expect, test } from 'vite-plus/test'
import { client } from './api.client'

test('client adds credentials include to typed API requests', async () => {
  const originalFetch = globalThis.fetch
  let requestInit: RequestInit | undefined

  globalThis.fetch = async (_input, init) => {
    requestInit = init
    return new Response(JSON.stringify({ count: 0, user: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const response = await client(
      '/api/user',
      {
        path: '/api/user',
        method: 'get'
      },
      {
        cache: 'no-store'
      }
    )

    expect(requestInit?.credentials).toBe('include')
    expect(requestInit?.cache).toBe('no-store')
    expect(requestInit?.method).toBe('get')
    expect(response).toEqual({ status: 200, body: { count: 0, user: [] } })
  } finally {
    globalThis.fetch = originalFetch
  }
})
