import { validator } from 'hono/validator'
import type * as schema from 'shared/src/schema'
import { z } from 'zod'
import { verifyAuthorizationMiddleware } from '../../../lib/middleware.js'
import { createHttpException } from '../../../lib/wrap.js'
import { updateUser, updateUserBodySchema } from './handler.js'

export function createRoute(
  app: import('hono').Hono,
  dbClient: ReturnType<typeof import('../../../lib/database.js').createClient>
) {
  type UpdateUserApi = schema.paths['/api/user/{id}']['put']
  type UpdateUserResponse = UpdateUserApi['responses']
  app.put(
    '/api/user/:id',
    verifyAuthorizationMiddleware(),
    validator('param', (value): { id: number } => {
      const parsedId = z.coerce.number().safeParse(value.id)
      if (!parsedId.success) {
        throw createHttpException<
          UpdateUserResponse['400']['content']['application/json']
        >(400, {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: parsedId.error.issues.map((issue) => issue.message).join(', ')
        })
      }
      return { id: parsedId.data }
    }),
    validator(
      'json',
      (value): UpdateUserApi['requestBody']['content']['application/json'] => {
        const parsed = updateUserBodySchema.safeParse(value)
        if (!parsed.success) {
          throw createHttpException<
            UpdateUserResponse['400']['content']['application/json']
          >(400, {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: parsed.error.issues.map((issue) => issue.message).join(', ')
          })
        }
        return parsed.data
      }
    ),
    async (c) => {
      const id = c.req.valid('param').id
      const body = c.req.valid('json')
      const res = await updateUser({ dbClient, id, body })
      return c.json(
        res satisfies schema.paths['/api/user/{id}']['put']['responses']['200']['content']['application/json']
      )
    }
  )
}
