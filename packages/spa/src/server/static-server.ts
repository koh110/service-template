import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { RuntimeConfig } from './config.js'
import { validateAuthority } from './authority.js'
import { sendTextResponse } from './http-response.js'
import { parseRequestTarget, type RequestTarget } from './request-target.js'
import { createApiProxy, type ApiProxy } from './proxy.js'

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json']
])

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

type StaticFile = {
  kind: 'file'
  filePath: string
  size: number
}

type FileInspection = StaticFile | { kind: 'missing' } | { kind: 'symlink' }

export function contentTypeOf(filePath: string) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? DEFAULT_CONTENT_TYPE
}

export function resolveStaticPath({ distDir, pathname }: { distDir: string; pathname: string }) {
  const root = path.resolve(distDir)
  const filePath = path.resolve(root, `.${pathname}`)
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return null
  }
  return { root, filePath }
}

async function inspectTrustedFile(root: string, filePath: string): Promise<FileInspection> {
  const rootStats = await fsp.lstat(root)
  if (rootStats.isSymbolicLink()) {
    return { kind: 'symlink' }
  }
  if (!rootStats.isDirectory()) {
    return { kind: 'missing' }
  }

  const relativePath = path.relative(root, filePath)
  if (
    relativePath.length === 0 ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return { kind: 'missing' }
  }

  let currentPath = root
  const segments = relativePath.split(path.sep)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment === undefined) {
      return { kind: 'missing' }
    }
    currentPath = path.join(currentPath, segment)
    let stats: fs.Stats
    try {
      stats = await fsp.lstat(currentPath)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { kind: 'missing' }
      }
      throw error
    }
    if (stats.isSymbolicLink()) {
      return { kind: 'symlink' }
    }
    const isLast = index === segments.length - 1
    if (!isLast && !stats.isDirectory()) {
      return { kind: 'missing' }
    }
    if (isLast && !stats.isFile()) {
      return { kind: 'missing' }
    }
    if (isLast) {
      return { kind: 'file', filePath: currentPath, size: stats.size }
    }
  }
  return { kind: 'missing' }
}

function cacheControlOf(root: string, filePath: string) {
  const relativePath = path.relative(root, filePath)
  if (relativePath.startsWith(`assets${path.sep}`)) {
    return IMMUTABLE_CACHE_CONTROL
  }
  return 'no-store'
}

async function sendFile({
  response,
  method,
  root,
  filePath,
  size
}: {
  response: http.ServerResponse
  method: string
  root: string
  filePath: string
  size: number
}) {
  const headers = {
    'content-type': contentTypeOf(filePath),
    'content-length': String(size),
    'cache-control': cacheControlOf(root, filePath),
    'x-content-type-options': 'nosniff'
  }
  if (method === 'HEAD') {
    response.writeHead(200, headers)
    response.end()
    return
  }
  try {
    const fileHandle = await fsp.open(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const stream = fileHandle.createReadStream({ autoClose: true })
    response.writeHead(200, headers)
    await pipeline(stream, response)
  } catch {
    if (!response.headersSent && !response.destroyed) {
      sendBadRequest(response, method)
      return
    }
    response.destroy()
  }
}

function sendBadRequest(response: http.ServerResponse, method: string) {
  sendTextResponse({ response, method, status: 400, body: 'Bad Request\n' })
}

function sendDevelopmentUnavailable(response: http.ServerResponse, method: string) {
  sendTextResponse({
    response,
    method,
    status: 503,
    body: 'Development server is not ready\n'
  })
}

function sendNotFound(response: http.ServerResponse, method: string) {
  sendTextResponse({ response, method, status: 404, body: 'Not Found\n' })
}

function sendMethodNotAllowed(response: http.ServerResponse, method: string, allow: string) {
  sendTextResponse({
    response,
    method,
    status: 405,
    body: 'Method Not Allowed\n',
    headers: { allow },
    headContentLength: method === 'HEAD' ? 0 : undefined
  })
}

async function serveStatic({
  request,
  response,
  config,
  target
}: {
  request: http.IncomingMessage
  response: http.ServerResponse
  config: RuntimeConfig
  target: Extract<RequestTarget, { kind: 'static' }>
}) {
  const method = request.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    sendMethodNotAllowed(response, method, 'GET, HEAD')
    return
  }

  const resolved = resolveStaticPath({ distDir: config.spaDistDir, pathname: target.pathname })
  if (resolved === null) {
    sendBadRequest(response, method)
    return
  }
  const direct = await inspectTrustedFile(resolved.root, resolved.filePath)
  if (direct.kind === 'symlink') {
    sendBadRequest(response, method)
    return
  }
  if (direct.kind === 'file') {
    await sendFile({
      response,
      method,
      root: resolved.root,
      filePath: direct.filePath,
      size: direct.size
    })
    return
  }

  if (path.extname(target.pathname) !== '') {
    sendNotFound(response, method)
    return
  }

  const indexPath = path.join(resolved.root, 'index.html')
  const index = await inspectTrustedFile(resolved.root, indexPath)
  if (index.kind === 'symlink') {
    sendBadRequest(response, method)
    return
  }
  if (index.kind !== 'file') {
    sendNotFound(response, method)
    return
  }
  await sendFile({
    response,
    method,
    root: resolved.root,
    filePath: index.filePath,
    size: index.size
  })
}

async function handleParsedTarget({
  request,
  response,
  config,
  target,
  proxy
}: {
  request: http.IncomingMessage
  response: http.ServerResponse
  config: RuntimeConfig
  target: RequestTarget
  proxy: ApiProxy
}) {
  const method = request.method ?? 'GET'
  if (target.kind === 'bad-request') {
    sendBadRequest(response, method)
    return
  }
  if (target.kind === 'reserved-api') {
    sendNotFound(response, method)
    return
  }
  if (target.kind === 'api-user') {
    if (method !== 'GET') {
      sendMethodNotAllowed(response, method, 'GET')
      return
    }
    await proxy.handleUserRequest({ request, response })
    return
  }
  await serveStatic({ request, response, config, target })
}

async function handleRequest({
  request,
  response,
  config,
  proxy
}: {
  request: http.IncomingMessage
  response: http.ServerResponse
  config: RuntimeConfig
  proxy: ApiProxy
}) {
  const authority = validateAuthority({
    request,
    authority: config.authority,
    origin: config.origin
  })
  if (!authority.ok) {
    sendTextResponse({
      response,
      method: request.method ?? 'GET',
      status: authority.status,
      body: authority.status === 403 ? 'Forbidden\n' : 'Bad Request\n',
      headContentLength: request.method === 'HEAD' ? 0 : undefined
    })
    return
  }
  const target = parseRequestTarget(request.url)
  await handleParsedTarget({ request, response, config, target, proxy })
}

export async function handleDevApiBoundary({
  req,
  res,
  next,
  config,
  proxy
}: {
  req: http.IncomingMessage
  res: http.ServerResponse
  next: () => void
  config: RuntimeConfig | null
  proxy: ApiProxy
}) {
  const target = parseRequestTarget(req.url)
  if (target.kind === 'static') {
    next()
    return
  }
  if (target.kind === 'bad-request') {
    sendBadRequest(res, req.method ?? 'GET')
    return
  }
  if (config === null) {
    sendDevelopmentUnavailable(res, req.method ?? 'GET')
    return
  }
  const authority = validateAuthority({
    request: req,
    authority: config.authority,
    origin: config.origin
  })
  if (!authority.ok) {
    sendTextResponse({
      response: res,
      method: req.method ?? 'GET',
      status: authority.status,
      body: authority.status === 403 ? 'Forbidden\n' : 'Bad Request\n',
      headContentLength: req.method === 'HEAD' ? 0 : undefined
    })
    return
  }
  await handleParsedTarget({ request: req, response: res, config, target, proxy })
}

export function createApplicationServer({
  config,
  fetchImplementation
}: {
  config: RuntimeConfig
  fetchImplementation?: typeof fetch
}) {
  const proxy = createApiProxy({
    apiUri: config.apiUri,
    fetchImplementation
  })
  const server = http.createServer((request, response) => {
    void handleRequest({ request, response, config, proxy }).catch(() => {
      if (!response.headersSent && !response.destroyed) {
        sendTextResponse({
          response,
          method: request.method ?? 'GET',
          status: 500,
          body: 'Internal Server Error\n'
        })
      } else {
        response.destroy()
      }
    })
  })
  return { server, abortAll: proxy.abortAll }
}
