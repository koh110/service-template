// @vitest-environment node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vite-plus/test'
import { formatAuthority, type RuntimeConfig } from './config.js'
import { createApiProxy } from './proxy.js'
import { createApplicationServer, contentTypeOf, handleDevApiBoundary } from './static-server.js'

type HttpResponse = {
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}

function createDist() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-template-spa-dist-'))
  fs.mkdirSync(path.join(root, 'assets'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>service template</title>')
  fs.writeFileSync(path.join(root, 'assets', 'app-abcdef.js'), 'export const app = 1\n')
  fs.writeFileSync(path.join(root, 'missing-target.txt'), 'not requested')
  return root
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
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => {
      if (error === undefined) {
        resolve()
        return
      }
      reject(error)
    })
  })
  return address.port
}

async function withServer(
  run: (context: {
    port: number
    authority: string
    origin: string
    root: string
    upstreamCalls: () => number
  }) => Promise<void>
) {
  const root = createDist()
  const port = await reservePort()
  const authority = formatAuthority('127.0.0.1', port)
  let upstreamCallCount = 0
  const upstream = http.createServer((request, response) => {
    if (request.url === '/api/user') {
      upstreamCallCount += 1
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          count: 2,
          user: [
            { id: 1, name: 'Alice', created_at: 1710000000, updated_at: 1710003600 },
            { id: 2, name: 'Bob', created_at: 1710007200, updated_at: 1710010800 }
          ]
        })
      )
      return
    }
    response.writeHead(404)
    response.end('missing')
  })
  await new Promise<void>((resolve) => {
    upstream.listen(0, '127.0.0.1', resolve)
  })
  const upstreamAddress = upstream.address()
  if (upstreamAddress === null || typeof upstreamAddress === 'string') {
    throw new Error('upstream did not bind')
  }
  const config = {
    apiUri: `http://127.0.0.1:${upstreamAddress.port}`,
    apiToken: 'test-token',
    host: '127.0.0.1',
    port,
    spaDistDir: root,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
  const application = createApplicationServer({ config })
  await new Promise<void>((resolve) => {
    application.server.listen(port, '127.0.0.1', resolve)
  })
  try {
    function upstreamCalls() {
      return upstreamCallCount
    }
    await run({ port, authority, origin: config.origin, root, upstreamCalls })
  } finally {
    application.abortAll()
    await new Promise<void>((resolve) => {
      application.server.close(() => {
        resolve()
      })
    })
    await new Promise<void>((resolve) => {
      upstream.close(() => {
        resolve()
      })
    })
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function request({
  port,
  requestPath,
  authority,
  method = 'GET',
  origin
}: {
  port: number
  requestPath: string
  authority: string
  method?: string
  origin?: string
}) {
  return new Promise<HttpResponse>((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = { Host: authority }
    if (origin !== undefined) {
      headers.Origin = origin
    }
    const request = http.request(
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
    request.on('error', reject)
    request.end()
  })
}

test('static server serves SPA fallback and immutable assets', async () => {
  await withServer(async ({ port, authority }) => {
    const page = await request({ port, authority, requestPath: '/dashboard' })
    expect(page.status).toBe(200)
    expect(page.body).toContain('service template')
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8')

    const asset = await request({ port, authority, requestPath: '/assets/app-abcdef.js' })
    expect(asset.status).toBe(200)
    expect(asset.headers['content-type']).toBe('text/javascript; charset=utf-8')
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(asset.headers['x-content-type-options']).toBe('nosniff')
  })
})

test('static server keeps missing assets out of SPA fallback and supports HEAD', async () => {
  await withServer(async ({ port, authority }) => {
    const missing = await request({ port, authority, requestPath: '/assets/missing.js' })
    expect(missing.status).toBe(404)
    expect(missing.body).toBe('Not Found\n')
    expect(missing.headers['cache-control']).toBe('no-store')

    const head = await request({
      port,
      authority,
      requestPath: '/assets/app-abcdef.js',
      method: 'HEAD'
    })
    expect(head.status).toBe(200)
    expect(head.body).toBe('')
    expect(head.headers['content-length']).toBe(String(Buffer.byteLength('export const app = 1\n')))
  })
})

test('static server enforces authority, origin, methods, and reserved API paths', async () => {
  await withServer(async ({ port, authority, origin, upstreamCalls }) => {
    const badHost = await request({ port, authority: '127.0.0.1:1', requestPath: '/' })
    expect(badHost.status).toBe(400)
    expect(badHost.body).toBe('Bad Request\n')

    const badOrigin = await request({
      port,
      authority,
      origin: 'http://evil.test',
      requestPath: '/'
    })
    expect(badOrigin.status).toBe(403)
    expect(badOrigin.body).toBe('Forbidden\n')

    const method = await request({ port, authority, requestPath: '/', method: 'POST' })
    expect(method.status).toBe(405)
    expect(method.headers.allow).toBe('GET, HEAD')

    const reserved = await request({ port, authority, requestPath: '/api/unknown' })
    expect(reserved.status).toBe(404)
    expect(reserved.body).toBe('Not Found\n')

    const query = await request({ port, authority, requestPath: '/api/user?x=1' })
    expect(query.status).toBe(400)
    expect(query.body).toBe('Bad Request\n')

    for (const requestPath of ['/api%2Fuser', '/%61pi/user', '/api%252Fuser']) {
      const encoded = await request({ port, authority, requestPath })
      expect(encoded.status).toBe(404)
      expect(encoded.body).toBe('Not Found\n')
    }

    const head = await request({ port, authority, requestPath: '/api/user', method: 'HEAD' })
    expect(head.status).toBe(405)
    expect(head.headers.allow).toBe('GET')
    expect(head.body).toBe('')

    const post = await request({ port, authority, requestPath: '/api/user', method: 'POST' })
    expect(post.status).toBe(405)
    expect(post.headers.allow).toBe('GET')
    expect(post.body).toBe('Method Not Allowed\n')

    const api = await request({ port, authority, origin, requestPath: '/api/user' })
    expect(api.status).toBe(200)
    expect(JSON.parse(api.body)).toEqual({
      count: 2,
      user: [
        { id: 1, name: 'Alice', created_at: 1710000000, updated_at: 1710003600 },
        { id: 2, name: 'Bob', created_at: 1710007200, updated_at: 1710010800 }
      ]
    })
    expect(api.headers['access-control-allow-origin']).toBeUndefined()
    expect(upstreamCalls()).toBe(1)
  })
})

test('static server rejects preexisting file and directory symlinks', async () => {
  await withServer(async ({ port, authority, root }) => {
    fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'assets', 'linked.js'))
    const file = await request({ port, authority, requestPath: '/assets/linked.js' })
    expect(file.status).toBe(400)
    expect(file.body).toBe('Bad Request\n')

    fs.symlinkSync(root, path.join(root, 'assets', 'linked-directory'), 'dir')
    const directory = await request({
      port,
      authority,
      requestPath: '/assets/linked-directory/app.js'
    })
    expect(directory.status).toBe(400)
    expect(directory.body).toBe('Bad Request\n')
  })
})

test('development API boundary fails closed before its authority is available', async () => {
  const port = await reservePort()
  const authority = formatAuthority('127.0.0.1', port)
  const proxy = createApiProxy({ apiUri: 'http://upstream.invalid', apiToken: 'test-token' })
  const server = http.createServer((req, res) => {
    void handleDevApiBoundary({
      req,
      res,
      next: () => {
        res.writeHead(418)
        res.end('next')
      },
      config: null,
      proxy
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve)
  })

  try {
    const api = await request({ port, authority, requestPath: '/api/user' })
    expect(api.status).toBe(503)
    expect(api.body).toBe('Development server is not ready\n')
    expect(api.headers['cache-control']).toBe('no-store')
    expect(api.headers['x-content-type-options']).toBe('nosniff')

    const malformed = await request({ port, authority, requestPath: '/a%ZZ' })
    expect(malformed.status).toBe(400)
    expect(malformed.body).toBe('Bad Request\n')

    const staticResponse = await request({ port, authority, requestPath: '/' })
    expect(staticResponse.status).toBe(418)
    expect(staticResponse.body).toBe('next')
  } finally {
    proxy.abortAll()
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  }
})

test('static server sanitizes missing tokens and upstream failures', async () => {
  const root = createDist()
  const port = await reservePort()
  const authority = formatAuthority('127.0.0.1', port)
  const config = {
    apiUri: 'http://127.0.0.1:1',
    apiToken: null,
    host: '127.0.0.1',
    port,
    spaDistDir: root,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
  const application = createApplicationServer({ config })
  await new Promise<void>((resolve) => {
    application.server.listen(port, '127.0.0.1', resolve)
  })
  try {
    const response = await request({ port, authority, requestPath: '/api/user' })
    expect(response.status).toBe(503)
    expect(response.body).toBe('API token is not configured\n')
    expect(response.body).not.toContain('test-token')
  } finally {
    application.abortAll()
    await new Promise<void>((resolve) => {
      application.server.close(() => {
        resolve()
      })
    })
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('known content types fail closed for unknown extensions', () => {
  expect(contentTypeOf('/assets/app.js')).toBe('text/javascript; charset=utf-8')
  expect(contentTypeOf('/assets/app.CSS')).toBe('text/css; charset=utf-8')
  expect(contentTypeOf('/assets/app.bin')).toBe('application/octet-stream')
})
