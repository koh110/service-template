import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from './logger.js'

export type ProblemDetails = {
  type: string
  title: string
  status: number
  detail?: string
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null && 'title' in value && 'status' in value
}

export function createHttpException<T extends Record<string, unknown>>(
  status: NonNullable<ConstructorParameters<typeof HTTPException>[0]>,
  body: T
): HTTPException {
  return new HTTPException(status, {
    res: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  })
}

export async function handleError(error: Error, c: Context) {
  const requestId = c.get('requestId')
  if (error instanceof HTTPException) {
    logger.debug({
      label: 'handleError',
      requestId,
      body: error.message,
      meta: { status: error.status },
      error
    })
    // res 付きの HTTPException(createHttpException 経由)はレスポンスの
    // 形状(拡張フィールドを含む)が確定しているため、そのまま返す。
    // cause 経由では拡張フィールドがクライアントに届かない罠があるため、
    // createHttpException は必ず res 付きで生成する
    if (error.res) {
      return error.getResponse()
    }
    const problem = isProblemDetails(error.cause)
      ? error.cause
      : { type: 'about:blank', title: error.message, status: error.status }
    return c.json(problem, error.status)
  }
  logger.error({
    label: 'handleError',
    requestId,
    body: 'Error occurred in handleError',
    error
  })
  return c.json(
    {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500
    } satisfies ProblemDetails,
    500
  )
}

export function numberToHonoHttpStatus(
  status: number
): NonNullable<ConstructorParameters<typeof HTTPException>[0]> {
  switch (status) {
    case 200:
    case 400:
    case 401:
    case 403:
    case 404:
    case 500:
      return status
    default:
      return 500
  }
}
