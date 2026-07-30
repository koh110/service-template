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
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'status' in value
  )
}

export function createHttpException(
  status: NonNullable<ConstructorParameters<typeof HTTPException>[0]>,
  body: { title: string; detail?: string; type?: string }
) {
  const problem: ProblemDetails = {
    type: body.type ?? 'about:blank',
    title: body.title,
    status,
    detail: body.detail
  }
  return new HTTPException(status, { message: body.title, cause: problem })
}

export async function handleError(error: Error, c: Context) {
  const requestId = c.get('requestId')
  if (error instanceof HTTPException) {
    logger.debug({
      label: 'handleError',
      body: error.message,
      meta: { requestId, error }
    })
    const problem = isProblemDetails(error.cause)
      ? error.cause
      : { type: 'about:blank', title: error.message, status: error.status }
    return c.json(problem, error.status)
  }
  logger.error({
    label: 'handleError',
    body: 'Error occurred in handleError',
    meta: { requestId },
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
