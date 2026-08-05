import { NextRequest } from 'next/server'
import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { DELETE, POST } = await import('./route')

function makeSessionRequest(options: {
  origin?: string
  body?: unknown
}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (options.origin !== undefined) {
    headers.set('origin', options.origin)
  }
  return new NextRequest('http://localhost:3000/api/auth/session', {
    method: 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })
}

test('rejects requests without a matching origin', async () => {
  const request = makeSessionRequest({
    origin: 'http://evil.example.com',
    body: { idToken: 'a@example.com' }
  })

  const res = await POST(request)

  expect(res.status).toBe(403)
})

test('rejects requests with a missing origin header', async () => {
  const request = makeSessionRequest({ body: { idToken: 'a@example.com' } })

  const res = await POST(request)

  expect(res.status).toBe(403)
})

test('rejects requests without an idToken', async () => {
  const request = makeSessionRequest({
    origin: 'http://localhost:3000',
    body: {}
  })

  const res = await POST(request)

  expect(res.status).toBe(400)
})

test('issues an httpOnly session cookie for a valid idToken', async () => {
  const request = makeSessionRequest({
    origin: 'http://localhost:3000',
    body: { idToken: 'a@example.com' }
  })

  const res = await POST(request)

  expect(res.status).toBe(200)
  const setCookie = res.cookies.get('session')
  expect(setCookie?.httpOnly).toBe(true)
  expect(setCookie?.sameSite).toBe('lax')
  expect(setCookie?.value.length).toBeGreaterThan(0)
})

test('DELETE clears the session cookie', async () => {
  const res = await DELETE()

  expect(res.status).toBe(200)
  const setCookie = res.cookies.get('session')
  expect(setCookie?.value).toBe('')
})
