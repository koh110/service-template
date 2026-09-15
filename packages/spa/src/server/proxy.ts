import { performance } from 'node:perf_hooks'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RuntimeConfig } from './config.js'
import { parseUserResponse } from '../api-contract.js'
import { sendJsonResponse, sendTextResponse } from './http-response.js'

const PROXY_TIMEOUT_MS = 5_000
const MAX_BODY_BYTES = 1_048_576

export type ApiProxy = ReturnType<typeof createApiProxy>

type ProxyOptions = Pick<RuntimeConfig, 'apiUri' | 'apiToken'> & {
  fetchImplementation?: typeof fetch
  now?: () => number
}

function assertDeadline(deadline: number, now: () => number, abort: () => void) {
  if (now() >= deadline) {
    abort()
    throw new Error('proxy deadline exceeded')
  }
}

async function readResponseBody({
  response,
  checkDeadline,
  abort
}: {
  response: Response
  checkDeadline: () => void
  abort: () => void
}) {
  if (response.body === null) {
    throw new Error('upstream response has no body')
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0
  try {
    while (true) {
      checkDeadline()
      const next = await reader.read()
      if (next.done) {
        break
      }
      const chunk = Buffer.from(next.value)
      if (totalBytes + chunk.byteLength > MAX_BODY_BYTES) {
        abort()
        await reader.cancel()
        throw new Error('upstream response is too large')
      }
      chunks.push(chunk)
      totalBytes += chunk.byteLength
    }
  } finally {
    reader.releaseLock()
  }

  checkDeadline()
  return Buffer.concat(chunks, totalBytes).toString('utf8')
}

export function createApiProxy({
  apiUri,
  apiToken,
  fetchImplementation = fetch,
  now = () => performance.now()
}: ProxyOptions) {
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
    if (apiToken === null) {
      sendTextResponse({
        response,
        method: request.method ?? 'GET',
        status: 503,
        body: 'API token is not configured\n'
      })
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
    const deadline = now() + PROXY_TIMEOUT_MS
    function checkDeadline() {
      assertDeadline(deadline, now, () => {
        controller.abort()
      })
    }

    try {
      checkDeadline()
      const upstreamResponse = await fetchImplementation(new URL('/api/user', apiUri), {
        method: 'GET',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      })
      checkDeadline()
      if (upstreamResponse.status !== 200) {
        throw new Error('upstream response was not successful')
      }

      const upstreamBody = await readResponseBody({
        response: upstreamResponse,
        checkDeadline,
        abort: () => {
          controller.abort()
        }
      })
      checkDeadline()
      let payload: unknown
      try {
        payload = JSON.parse(upstreamBody)
      } catch {
        throw new Error('upstream response was not JSON')
      }
      checkDeadline()
      const parsed = parseUserResponse(payload)
      if (parsed === null) {
        throw new Error('upstream response shape was invalid')
      }
      checkDeadline()
      const serialized = JSON.stringify(parsed)
      if (serialized === undefined) {
        throw new Error('response serialization failed')
      }
      checkDeadline()
      if (response.destroyed) {
        return
      }
      settled = true
      sendJsonResponse({
        response,
        method: request.method ?? 'GET',
        body: serialized
      })
    } catch {
      if (!response.headersSent && !response.destroyed) {
        settled = true
        sendTextResponse({
          response,
          method: request.method ?? 'GET',
          status: 502,
          body: 'Bad Gateway\n'
        })
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
