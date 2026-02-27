import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import type { schema } from 'shared/src/index'
import * as user from './handlers/user/index.js'
import { createClient } from './lib/database.js'
import { logger } from './lib/logger.js'

export async function createApp() {
  const dbClient = createClient()
  await dbClient.$connect()

  const app = new Hono()
  app.use(
    honoLogger((message, ...rest) => {
      logger.log({
        label: 'log',
        body: message,
        meta: rest
      })
    })
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
