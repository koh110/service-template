// @vitest-environment node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
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
        reject(new Error('timed out waiting for upstream disconnect'))
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
    apiToken = 'test-token',
    fetchImplementation = fetch,
    now
  }: {
    apiUri?: string
    apiToken?: string | null
    fetchImplementation?: typeof fetch
    now?: () => number
  },
  run: (context: ProxyContext) => Promise<void>
) {
  const root = createDist()
  const port = await reservePort()
  const authority = formatAuthority('127.0.0.1', port)
  const config = {
    apiUri,
    apiToken,
    host: '127.0.0.1',
    port,
    spaDistDir: root,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
  const application = createApplicationServer({ config, fetchImplementation, now })
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
  origin
}: {
  port: number
  authority: string
  requestPath?: string
  method?: string
  origin?: string
}) {
  return new Promise<HttpResponse>((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = { Host: authority }
    if (origin !== undefined) {
      headers.Origin = origin
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

function repeatedName(length: number) {
  return 'x'.repeat(length)
}

function deterministicName(length: number) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
  let state = 0x12345678
  let value = ''
  for (let index = 0; index < length; index += 1) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    value += alphabet[state % alphabet.length]
  }
  return value
}

function userBodyWithSize(size: number, createName = repeatedName) {
  const emptyBody = JSON.stringify({
    count: 1,
    user: [{ id: 1, name: '', created_at: 0, updated_at: 0 }]
  })
  const nameLength = size - Buffer.byteLength(emptyBody)
  if (nameLength < 0) {
    throw new Error('requested body size is too small')
  }
  const body = JSON.stringify({
    count: 1,
    user: [{ id: 1, name: createName(nameLength), created_at: 0, updated_at: 0 }]
  })
  if (Buffer.byteLength(body) !== size) {
    throw new Error('could not create requested body size')
  }
  return body
}

test('proxy accepts decoded bodies at and below one MiB and rejects larger bodies', async () => {
  for (const size of [1_048_575, 1_048_576, 1_048_577]) {
    const body = userBodyWithSize(size)
    await withProxyServer(
      {
        fetchImplementation: async () => {
          return new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
      },
      async ({ port, authority }) => {
        const response = await request({ port, authority })
        expect(response.status).toBe(size <= 1_048_576 ? 200 : 502)
        expect(response.body).not.toContain('API token')
      }
    )
  }
})

test('proxy enforces decoded size for genuine gzip responses and aborts overflow', async () => {
  for (const size of [1_048_575, 1_048_576, 1_048_577]) {
    const decodedBody = userBodyWithSize(size, deterministicName)
    const encodedBody = gzipSync(decodedBody)
    let sentAll = false
    let upstreamAbortedResolve: () => void = () => {}
    const upstreamAborted = new Promise<void>((resolve) => {
      upstreamAbortedResolve = resolve
    })
    const upstream = http.createServer((request, response) => {
      response.on('error', () => {})
      response.once('close', () => {
        if (!sentAll) {
          upstreamAbortedResolve()
        }
      })
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      })
      let offset = 0
      function writeChunk() {
        if (response.destroyed || request.destroyed) {
          return
        }
        if (offset >= encodedBody.byteLength) {
          const timer = setTimeout(() => {
            if (response.destroyed) {
              return
            }
            sentAll = true
            response.end()
          }, 250)
          timer.unref()
          return
        }
        const chunk = encodedBody.subarray(offset, offset + 16_384)
        offset += chunk.byteLength
        response.write(chunk)
        const timer = setTimeout(writeChunk, 2)
        timer.unref()
      }
      writeChunk()
    })
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', resolve)
    })
    const address = upstream.address()
    if (address === null || typeof address === 'string') {
      throw new Error('upstream did not bind')
    }
    let fetchAborted = false
    const fetchImplementation: typeof fetch = async (input, init) => {
      const signal = init?.signal
      if (signal === undefined || signal === null) {
        throw new Error('proxy signal was not provided')
      }
      signal.addEventListener('abort', () => {
        fetchAborted = true
      })
      return await fetch(input, init)
    }

    try {
      await withProxyServer(
        {
          apiUri: `http://127.0.0.1:${address.port}`,
          fetchImplementation
        },
        async ({ port, authority }) => {
          const response = await request({ port, authority })
          expect(response.status).toBe(size <= 1_048_576 ? 200 : 502)
          if (size > 1_048_576) {
            expect(response.body).toBe('Bad Gateway\n')
          }
        }
      )
      if (size > 1_048_576) {
        await waitForPromise(upstreamAborted, 2_000)
        expect(fetchAborted).toBe(true)
      }
    } finally {
      await closeServer(upstream)
    }
  }
})

test('proxy rejects an upstream redirect', async () => {
  const upstream = http.createServer((_request, response) => {
    response.writeHead(302, { location: 'http://evil.test/api/user' })
    response.end()
  })
  await new Promise<void>((resolve) => {
    upstream.listen(0, '127.0.0.1', resolve)
  })
  const address = upstream.address()
  if (address === null || typeof address === 'string') {
    throw new Error('upstream did not bind')
  }

  try {
    await withProxyServer(
      { apiUri: `http://127.0.0.1:${address.port}` },
      async ({ port, authority }) => {
        const response = await request({ port, authority })
        expect(response.status).toBe(502)
        expect(response.body).toBe('Bad Gateway\n')
      }
    )
  } finally {
    await closeServer(upstream)
  }
})

test('proxy aborts when the monotonic deadline expires during processing', async () => {
  let clockCalls = 0
  let signalAborted = false
  function now() {
    clockCalls += 1
    return clockCalls < 3 ? 0 : 5_001
  }
  const fetchImplementation: typeof fetch = async (_input, init) => {
    const signal = init?.signal
    if (signal === undefined || signal === null) {
      throw new Error('proxy signal was not provided')
    }
    signal.addEventListener('abort', () => {
      signalAborted = true
    })
    return new Response(
      JSON.stringify({
        count: 1,
        user: [{ id: 1, name: 'Alice', created_at: 0, updated_at: 0 }]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  await withProxyServer({ fetchImplementation, now }, async ({ port, authority }) => {
    const response = await request({ port, authority })
    expect(response.status).toBe(502)
  })
  expect(signalAborted).toBe(true)
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
        headers: { Host: authority }
      },
      (response) => {
        response.resume()
      }
    )
    client.on('error', () => {})
    client.end()
    await fetchStarted
    client.destroy()
    await fetchAborted
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
    const responsePromise = request({ port, authority })
    await fetchStarted
    application.abortAll()
    await fetchAborted
    const response = await responsePromise
    expect(response.status).toBe(502)
  })
})
