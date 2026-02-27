import fs from 'fs'

async function proxy(r) {
  try {
    const content = await fs.promises.readFile(
      '/etc/nginx/dynamic/api.json',
      'utf8'
    )
    const data = JSON.parse(content)
    const port =
      data &&
      (typeof data.port === 'number' || typeof data.port === 'string')
        ? String(data.port)
        : ''
    if (!port) {
      return r.return(503, 'API is starting or port file not found...')
    }
    const hosts = await fs.promises.readFile('/etc/hosts', 'utf8')
    const hostMatch = hosts.match(
      /^(?:\s*)(\d{1,3}(?:\.\d{1,3}){3})\s+host\.docker\.internal\b/m
    )
    const host = hostMatch ? hostMatch[1] : 'host.docker.internal'
    r.variables.api_address = `${host}:${port}`
    return r.internalRedirect('@proxy')
  } catch (e) {
    return r.return(503, 'API is starting or port file not found...')
  }
}

export default { proxy }
