import { validator } from 'hono/validator'
import type { schema } from 'shared/src/index'
import { z } from 'zod'
import { verifyAuthorizationMiddleware } from '../../../lib/middleware.js'
import { handleError } from '../../../lib/wrap.js'
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
    validator('param', (value, c) => {
      const parsedId = z.coerce.number().safeParse(value.id)
      if (!parsedId.success) {
        return c.json(
          {
            message: 'Invalid id',
            cause: parsedId.error.issues.join(',')
          } satisfies UpdateUserResponse['400']['content']['application/json'],
          { status: 400 }
        )
      }
      return { id: parsedId.data }
    }),
    validator('json', (value, c) => {
      const parsed = updateUserBodySchema.safeParse(value)
      if (!parsed.success) {
        return c.json(
          {
            message: 'Invalid request body',
            cause: parsed.error.issues.join(',')
          } satisfies UpdateUserResponse['400']['content']['application/json'],
          { status: 400 }
        )
      }
      return parsed.data
    }),
    async (c) => {
      const id = c.req.valid('param').id
      const body = c.req.valid('json')
      try {
        const res = await updateUser({ dbClient, id, body })
        return c.json(
          res satisfies schema.paths['/api/user/{id}']['put']['responses']['200']['content']['application/json']
        )
      } catch (e) {
        return handleError(c, e)
      }
    }
  )
}
