import type { schema } from 'shared/src/index'
import { verifyAuthorizationMiddleware } from '../../lib/middleware.js'
import { handleError } from '../../lib/wrap.js'
import { createRoute as createRouteId } from './{id}/index.js'
import { listUser } from './handler.js'

export function createRoute(
  app: import('hono').Hono,
  dbClient: ReturnType<typeof import('../../lib/database.js').createClient>
) {
  createRouteId(app, dbClient)

  app.get(
    '/api/user' satisfies keyof schema.paths,
    verifyAuthorizationMiddleware(),
    async (c) => {
      try {
        const res = await listUser({ dbClient })
        return c.json(
          res satisfies schema.paths['/api/user']['get']['responses']['200']['content']['application/json']
        )
      } catch (e) {
        return handleError(c, e)
      }
    }
  )
}
