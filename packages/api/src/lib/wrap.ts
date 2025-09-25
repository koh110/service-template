import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from './logger.js'

export async function handleError(c: Context, error: unknown) {
  if (error instanceof HTTPException) {
    logger.debug({
      label: 'handleError',
      body: error.message,
      meta: error
    })
    return c.json({ error: error.message, cause: error.cause }, error.status)
  }
  logger.error({
    label: 'handleError',
    body: 'Error occurred in handleError',
    error
  })
  return c.json({ error: 'Internal Server Error' }, { status: 500 })
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
