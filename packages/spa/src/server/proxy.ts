import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RuntimeConfig } from './config.js'
import { sendTextResponse } from './http-response.js'

const PROXY_TIMEOUT_MS = 5_000
const SESSION_COOKIE_NAME = 'session'
const COOKIE_OCTETS = /^[\u0021\u0023-\u002B\u002D-\u003A\u003C-\u005B\u005D-\u007E]+$/u

export type ApiProxy = ReturnType<typeof createApiProxy>

type ProxyOptions = Pick<RuntimeConfig, 'apiUri'> & {
  fetchImplementation?: typeof fetch
}

function readSessionCookie(request: IncomingMessage) {
  const cookieHeader = request.headers.cookie
  if (cookieHeader === undefined) {
    return null
  }

  let session: string | null = null
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator <= 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE_NAME) {
      continue
    }
    if (session !== null) {
      return null
    }
    const value = cookie.slice(separator + 1).trim()
    if (value.length === 0) {
      return null
    }
    if (!COOKIE_OCTETS.test(value)) {
      return null
    }
    session = value
  }
  return session
}

function sendAuthenticationFailure(response: ServerResponse, method: string, status: 401 | 403) {
  sendTextResponse({
    response,
    method,
    status,
    body: status === 403 ? 'Forbidden\n' : 'Not authenticated\n'
  })
}

function sendBadGateway(response: ServerResponse, method: string) {
  sendTextResponse({
    response,
    method,
    status: 502,
    body: 'Bad Gateway\n'
  })
}

async function sendUpstreamJson({
  response,
  method,
  body
}: {
  response: ServerResponse
  method: string
  body: Response['body']
}) {
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  if (body === null || method === 'HEAD') {
    await body?.cancel()
    response.end()
    return
  }

  const reader = body.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      if (response.destroyed) {
        throw new Error('client closed response')
      }
      if (!response.write(chunk.value)) {
        await new Promise<void>((resolve, reject) => {
          let settled = false
          const cleanup = () => {
            response.off('drain', onDrain)
            response.off('error', onError)
            response.off('close', onClose)
          }
          const onDrain = () => {
            if (settled) {
              return
            }
            settled = true
            cleanup()
            resolve()
          }
          const onError = (error: Error) => {
            if (settled) {
              return
            }
            settled = true
            cleanup()
            reject(error)
          }
          const onClose = () => {
            if (settled || response.writableFinished) {
              return
            }
            settled = true
            cleanup()
            reject(new Error('client closed response'))
          }
          response.once('drain', onDrain)
          response.once('error', onError)
          response.once('close', onClose)
        })
      }
    }

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        response.off('finish', onFinish)
        response.off('error', onError)
        response.off('close', onClose)
      }
      const onFinish = () => {
        cleanup()
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const onClose = () => {
        if (response.writableFinished) {
          return
        }
        cleanup()
        reject(new Error('client closed response'))
      }
      response.once('finish', onFinish)
      response.once('error', onError)
      response.once('close', onClose)
      response.end()
    })
  } catch (error) {
    try {
      await reader.cancel()
    } catch {
      // The upstream stream may already be closed after a client disconnect.
    }
    response.destroy()
    throw error
  } finally {
    reader.releaseLock()
  }
}

export function createApiProxy({ apiUri, fetchImplementation = fetch }: ProxyOptions) {
  const activeControllers = new Set<AbortController>()

  function abortAll() {
    for (const controller of activeControllers) {
      controller.abort()
    }
  }

  async function handleUserRequest({
    request,
    response
  }: {
    request: IncomingMessage
    response: ServerResponse
  }) {
    const sessionCookie = readSessionCookie(request)
    if (sessionCookie === null) {
      sendAuthenticationFailure(response, request.method ?? 'GET', 401)
      return
    }

    const controller = new AbortController()
    activeControllers.add(controller)
    let settled = false
    const abortOnDisconnect = () => {
      if (!settled) {
        controller.abort()
      }
    }
    request.once('aborted', abortOnDisconnect)
    response.once('close', abortOnDisconnect)
    const timeout = setTimeout(() => {
      controller.abort()
    }, PROXY_TIMEOUT_MS)

    try {
      const upstreamResponse = await fetchImplementation(new URL('/api/user', apiUri), {
        method: 'GET',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${sessionCookie}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      })
      if (upstreamResponse.status !== 200) {
        const status = upstreamResponse.status
        await upstreamResponse.body?.cancel()
        if (status === 401 || status === 403) {
          settled = true
          sendAuthenticationFailure(response, request.method ?? 'GET', status)
          return
        }
        throw new Error('upstream response was not successful')
      }

      if (response.destroyed) {
        controller.abort()
        await upstreamResponse.body?.cancel()
        return
      }
      await sendUpstreamJson({
        response,
        method: request.method ?? 'GET',
        body: upstreamResponse.body
      })
      settled = true
    } catch {
      if (!response.headersSent && !response.destroyed) {
        settled = true
        sendBadGateway(response, request.method ?? 'GET')
      }
    } finally {
      clearTimeout(timeout)
      activeControllers.delete(controller)
      request.off('aborted', abortOnDisconnect)
      response.off('close', abortOnDisconnect)
      settled = true
    }
  }

  return {
    handleUserRequest,
    abortAll
  }
}
