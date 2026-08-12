import { Hono } from 'hono'
import type { schema } from 'shared/src/index'
import * as user from './handlers/user/index.js'
import { createClient } from './lib/database.js'
import { accessLogMiddleware, corsMiddleware } from './lib/middleware.js'
import type { ProblemDetails } from './lib/wrap.js'
import { handleError } from './lib/wrap.js'

export async function createApp() {
  const dbClient = createClient()
  await dbClient.$connect()

  const app = new Hono()
  app.use(accessLogMiddleware())
  app.use('/api/*', corsMiddleware)
  app.onError(handleError)
  app.notFound((c) =>
    c.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404
      } satisfies ProblemDetails,
      404
    )
  )

  app.get('/', (c) => c.text('Hello'))

  app.get('/healthcheck', async (c) => {
    const body =
      'ok' satisfies schema.paths['/healthcheck']['get']['responses'][200]['content']['text/plain']
    return c.text(body)
  })

  user.createRoute(app, dbClient)

  return app
}
