import { Hono } from 'hono'
import { schema } from 'shared/src/index'

export async function createApp() {
  const app = new Hono()

  app.get('/', (c) => c.text('Hello'))

  app.get('/healthcheck', async (c) => {
    const body =
      'ok' satisfies schema.paths['/healthcheck']['get']['responses'][200]['content']['text/plain']
    return c.text(body)
  })

  return app
}
