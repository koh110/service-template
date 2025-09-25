import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import { CORS_OPTIONS } from '../config.js'
import { logger } from '../lib/logger.js'

export const corsMiddleware = cors(CORS_OPTIONS)

export function verifyAuthorizationMiddleware() {
  return createMiddleware<{
    Variables: {
      sessionToken: string | undefined
    }
  }>(async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (!authorization) {
      return c.json({ error: 'Authorization error' }, 401)
    }
    try {
      const [, sessionToken] = authorization.split(' ')
      // // todo
      // await verifyToken(sessionToken)
      c.set('sessionToken', sessionToken)
      await next()
    } catch (error) {
      logger.log({
        label: 'firebase_verification',
        body: 'Firebase ID token verification failed',
        meta: { error }
      })
      return c.json({ error: 'Authorization error' }, 401)
    }
  })
}
