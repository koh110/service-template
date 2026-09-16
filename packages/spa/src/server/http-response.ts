import type { ServerResponse } from 'node:http'

export function sendTextResponse({
  response,
  method,
  status,
  body,
  headers = {},
  headContentLength
}: {
  response: ServerResponse
  method: string
  status: number
  body: string
  headers?: Record<string, string>
  headContentLength?: number
}) {
  const payload = Buffer.from(body, 'utf8')
  const contentLength =
    method === 'HEAD' && headContentLength !== undefined ? headContentLength : payload.byteLength
  response.writeHead(status, {
    ...headers,
    'content-type': 'text/plain; charset=utf-8',
    'content-length': String(contentLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  if (method === 'HEAD' || body.length === 0) {
    response.end()
    return
  }
  response.end(payload)
}
