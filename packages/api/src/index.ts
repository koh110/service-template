import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { ENV, PORT } from './config.js'
import { logger } from './lib/logger.js'

let server: ReturnType<typeof serve> | null = null

async function main() {
  const app = await createApp()

  server = serve(
    {
      fetch: app.fetch,
      port: PORT
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`)
    }
  )
}
main().catch(console.error)

// graceful shutdown
if (ENV.production) {
  process.on('SIGTERM', (signal) => {
    logger.log({ label: 'graceful shutdown', body: signal })
    if (!server) {
      process.exit(0)
    }
    server.close((err) => {
      if (err) {
        logger.error({ label: 'graceful shutdown', body: 'error', error: err })
        return process.exit(1)
      }
      logger.log({ label: 'graceful shutdown', body: 'exit' })
      process.exit(0)
    })

    setTimeout(() => {
      logger.error({ label: 'graceful shutdown', body: 'timeout' })
      process.exit(1)
    }, 20000)
  })
}
