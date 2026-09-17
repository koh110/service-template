import { expect, test } from 'vite-plus/test'
import { client } from './api.client'

test('client adds credentials without exposing the upstream Authorization header', async () => {
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

    const headers = new Headers(requestInit?.headers)
    expect(requestInit?.credentials).toBe('include')
    expect(requestInit?.cache).toBe('no-store')
    expect(requestInit?.method).toBe('get')
    expect(headers.has('Authorization')).toBe(false)
    expect(response).toEqual({ status: 200, body: { count: 0, user: [] } })
  } finally {
    globalThis.fetch = originalFetch
  }
})
