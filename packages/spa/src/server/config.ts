import fs from 'node:fs'
import path from 'node:path'

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'] as const

type Environment = Record<string, string | undefined>

export type RuntimeConfig = {
  apiUri: string
  host: string
  port: number
  spaDistDir: string
  authority: string
  origin: string
}

function resolvePort(raw: string | undefined) {
  const value = (raw ?? '').trim()
  if (value.length === 0) {
    return 8789
  }
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  return port
}

function isLoopbackHost(value: string): value is (typeof LOOPBACK_HOSTS)[number] {
  for (const allowedHost of LOOPBACK_HOSTS) {
    if (allowedHost === value) {
      return true
    }
  }
  return false
}

function resolveHost(raw: string | undefined) {
  const host = (raw ?? '').trim() || '127.0.0.1'
  if (!isLoopbackHost(host)) {
    throw new Error('HOST must be one of 127.0.0.1, localhost, or ::1')
  }
  return host
}

function resolveApiUri(raw: string | undefined) {
  const value = (raw ?? '').trim() || 'http://localhost:8000'
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('API_URI must be an http or https origin')
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    value.endsWith('/')
  ) {
    throw new Error('API_URI must be an http or https origin')
  }
  return url.origin
}

export function formatAuthority(host: string, port: number) {
  const authorityHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `${authorityHost}:${port}`
}

export function loadConfig(environment: Environment = process.env) {
  const host = resolveHost(environment.HOST)
  const port = resolvePort(environment.PORT)
  const authority = formatAuthority(host, port)
  const configuredDistDir = (environment.SPA_DIST_DIR ?? '').trim()
  const spaDistDir =
    configuredDistDir.length > 0
      ? path.resolve(configuredDistDir)
      : path.resolve(import.meta.dirname, '../../dist/public')

  return {
    apiUri: resolveApiUri(environment.API_URI),
    host,
    port,
    spaDistDir,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
}

export async function assertDistribution(distDir: string) {
  const rootStats = await fs.promises.lstat(distDir)
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error('SPA_DIST_DIR must be a non-symlink directory')
  }
  const indexStats = await fs.promises.lstat(path.join(distDir, 'index.html'))
  if (indexStats.isSymbolicLink() || !indexStats.isFile()) {
    throw new Error('SPA_DIST_DIR must contain a non-symlink index.html')
  }
}

export const config = loadConfig()
