// @vitest-environment node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vite-plus/test'
import { formatAuthority, type RuntimeConfig } from './config.js'
import { createApplicationServer } from './static-server.js'

type HttpResponse = {
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}

type ProxyContext = {
  port: number
  authority: string
  application: ReturnType<typeof createApplicationServer>
}

async function reservePort() {
  const probe = http.createServer()
  await new Promise<void>((resolve) => {
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  if (address === null || typeof address === 'string') {
    throw new Error('probe did not bind')
  }
  const port = address.port
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }
      reject(error)
    })
  })
  return port
}

async function closeServer(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }
      reject(error)
    })
  })
}

async function waitForPromise(promise: Promise<void>, timeoutMs: number) {
  await Promise.race([
    promise,
    new Promise<void>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('timed out waiting for upstream cancellation'))
      }, timeoutMs)
      timer.unref()
    })
  ])
}

function createDist() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-template-spa-proxy-'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>')
  return root
}

async function withProxyServer(
  {
    apiUri = 'http://upstream.invalid',
    fetchImplementation = fetch
  }: {
    apiUri?: string
    fetchImplementation?: typeof fetch
  },
  run: (context: ProxyContext) => Promise<void>
) {
  const root = createDist()
  const port = await reservePort()
  const authority = formatAuthority('127.0.0.1', port)
  const config = {
    apiUri,
    host: '127.0.0.1',
    port,
    spaDistDir: root,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
  const application = createApplicationServer({ config, fetchImplementation })
  await new Promise<void>((resolve) => {
    application.server.listen(port, '127.0.0.1', resolve)
  })

  try {
    await run({ port, authority, application })
  } finally {
    application.abortAll()
    await closeServer(application.server)
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function request({
  port,
  authority,
  requestPath = '/api/user',
  method = 'GET',
  cookie
}: {
  port: number
  authority: string
  requestPath?: string
  method?: string
  cookie?: string
}) {
  return new Promise<HttpResponse>((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = { Host: authority }
    if (cookie !== undefined) {
      headers.Cookie = cookie
    }
    const client = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8')
          })
        })
      }
    )
    client.on('error', reject)
    client.end()
  })
}

test('proxy requires the session cookie and does not call upstream without it', async () => {
  let fetchCalls = 0
  const fetchImplementation: typeof fetch = async () => {
    fetchCalls += 1
    return new Response('{}', { status: 200 })
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
    for (const cookie of [
      undefined,
      'session=',
      'session=one; session=two',
      'session=invalid value'
    ]) {
      const response = await request({ port, authority, cookie })
      expect(response.status).toBe(401)
      expect(response.body).toBe('Not authenticated\n')
    }
  })
  expect(fetchCalls).toBe(0)
})

test('proxy converts the session cookie to the upstream authorization header', async () => {
  let upstreamUrl = ''
  let authorization: string | null = null
  let credentials: RequestCredentials | undefined
  const fetchImplementation: typeof fetch = async (input, init) => {
    if (typeof input === 'string') {
      upstreamUrl = input
    } else if (input instanceof URL) {
      upstreamUrl = input.toString()
    } else {
      upstreamUrl = input.url
    }
    authorization = new Headers(init?.headers).get('authorization')
    credentials = init?.credentials
    return new Response(
      JSON.stringify({
        count: 1,
        user: [{ id: 1, name: 'Alice', created_at: 0, updated_at: 0 }]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  await withProxyServer(
    { apiUri: 'https://api.example.test', fetchImplementation },
    async ({ port, authority }) => {
      const response = await request({
        port,
        authority,
        cookie: 'theme=dark; session=opaque-session; locale=ja',
        requestPath: '/api/user'
      })
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        count: 1,
        user: [{ id: 1, name: 'Alice', created_at: 0, updated_at: 0 }]
      })
    }
  )

  expect(upstreamUrl).toBe('https://api.example.test/api/user')
  expect(authorization).toBe('Bearer opaque-session')
  expect(credentials).toBeUndefined()
})

test('proxy preserves sanitized authentication failures from upstream', async () => {
  for (const [status, body] of [
    [401, 'Not authenticated\n'],
    [403, 'Forbidden\n']
  ] as const) {
    const fetchImplementation: typeof fetch = async () => {
      return new Response('upstream secret details', {
        status,
        headers: { 'content-type': 'text/plain' }
      })
    }

    await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
      const response = await request({
        port,
        authority,
        cookie: 'session=opaque-session'
      })
      expect(response.status).toBe(status)
      expect(response.body).toBe(body)
      expect(response.body).not.toContain('opaque-session')
      expect(response.body).not.toContain('upstream secret details')
    })
  }
})

test('proxy returns a sanitized gateway error for upstream server failures', async () => {
  const fetchImplementation: typeof fetch = async () => {
    return new Response('upstream secret details', {
      status: 500,
      headers: { 'content-type': 'text/plain' }
    })
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
    const response = await request({
      port,
      authority,
      cookie: 'session=opaque-session'
    })
    expect(response.status).toBe(502)
    expect(response.body).toBe('Bad Gateway\n')
    expect(response.body).not.toContain('opaque-session')
    expect(response.body).not.toContain('upstream secret details')
  })
})

test('proxy passes the successful response to the browser without server-side shape validation', async () => {
  const fetchImplementation: typeof fetch = async () => {
    return new Response('{"unexpected":"shape"}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
    const response = await request({
      port,
      authority,
      cookie: 'session=opaque-session'
    })
    expect(response.status).toBe(200)
    expect(response.body).toBe('{"unexpected":"shape"}')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })
})

test('proxy rejects an upstream redirect and does not follow it', async () => {
  let requestInit: RequestInit | undefined
  const fetchImplementation: typeof fetch = async (_input, init) => {
    requestInit = init
    throw new TypeError('redirect disallowed')
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
    const response = await request({
      port,
      authority,
      cookie: 'session=opaque-session'
    })
    expect(response.status).toBe(502)
    expect(response.body).toBe('Bad Gateway\n')
  })
  expect(requestInit?.redirect).toBe('error')
})

test('proxy aborts an upstream fetch when the client disconnects', async () => {
  let fetchStartedResolve: () => void = () => {}
  const fetchStarted = new Promise<void>((resolve) => {
    fetchStartedResolve = resolve
  })
  let fetchAbortedResolve: () => void = () => {}
  const fetchAborted = new Promise<void>((resolve) => {
    fetchAbortedResolve = resolve
  })
  const fetchImplementation: typeof fetch = async (_input, init) => {
    fetchStartedResolve()
    const signal = init?.signal
    if (signal === undefined || signal === null) {
      throw new Error('proxy signal was not provided')
    }
    return await new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          fetchAbortedResolve()
          reject(new Error('upstream fetch aborted'))
        },
        { once: true }
      )
    })
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority }) => {
    const client = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/user',
        headers: { Host: authority, Cookie: 'session=opaque-session' }
      },
      (response) => {
        response.resume()
      }
    )
    client.on('error', () => {})
    client.end()
    await fetchStarted
    client.destroy()
    await waitForPromise(fetchAborted, 2_000)
  })
})

test('proxy aborts an upstream fetch during application shutdown', async () => {
  let fetchStartedResolve: () => void = () => {}
  const fetchStarted = new Promise<void>((resolve) => {
    fetchStartedResolve = resolve
  })
  let fetchAbortedResolve: () => void = () => {}
  const fetchAborted = new Promise<void>((resolve) => {
    fetchAbortedResolve = resolve
  })
  const fetchImplementation: typeof fetch = async (_input, init) => {
    fetchStartedResolve()
    const signal = init?.signal
    if (signal === undefined || signal === null) {
      throw new Error('proxy signal was not provided')
    }
    return await new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          fetchAbortedResolve()
          reject(new Error('upstream fetch aborted'))
        },
        { once: true }
      )
    })
  }

  await withProxyServer({ fetchImplementation }, async ({ port, authority, application }) => {
    const responsePromise = request({
      port,
      authority,
      cookie: 'session=opaque-session'
    })
    await fetchStarted
    application.abortAll()
    await waitForPromise(fetchAborted, 2_000)
    const response = await responsePromise
    expect(response.status).toBe(502)
  })
})
