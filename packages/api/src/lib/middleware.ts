import { randomUUID } from 'node:crypto'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import type * as schema from 'shared/src/schema'
import { CORS_OPTIONS } from '../config.js'
import { localTokenVerifier } from '../lib/auth/local-verifier.js'
import type { TokenVerifier } from '../lib/auth/token-verifier.js'
import { logger } from '../lib/logger.js'
import { createHttpException } from './wrap.js'

// 実プロバイダ(Firebase Admin 等)に差し替える場合はここを変更する
const tokenVerifier: TokenVerifier = localTokenVerifier

type UnauthorizedError = schema.components['schemas']['UnauthorizedError']

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}

export const corsMiddleware = cors(CORS_OPTIONS)

export function accessLogMiddleware() {
  return createMiddleware(async (c, next) => {
    const requestId = randomUUID()
    c.set('requestId', requestId)
    const start = Date.now()
    await next()
    logger.log({
      label: 'access',
      body: `${c.req.method} ${c.req.path}`,
      meta: {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: Date.now() - start
      }
    })
  })
}

export function verifyAuthorizationMiddleware() {
  return createMiddleware<{
    Variables: {
      sessionToken: string | undefined
    }
  }>(async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (!authorization) {
      throw createHttpException<UnauthorizedError>(401, {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authorization error'
      })
    }
    const [, sessionToken] = authorization.split(' ')
    if (!sessionToken) {
      throw createHttpException<UnauthorizedError>(401, {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authorization error'
      })
    }
    try {
      await tokenVerifier.verify(sessionToken)
      c.set('sessionToken', sessionToken)
    } catch (error) {
      logger.log({
        label: 'token_verification',
        body: 'token verification failed',
        meta: { error }
      })
      throw createHttpException<UnauthorizedError>(401, {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authorization error'
      })
    }
    // `next()` は try の外で呼ぶ。中に入れると下流ハンドラが投げる例外
    // (404/500 等)までこの catch が飲み込み、誤って 401 に変換してしまう
    await next()
  })
}
