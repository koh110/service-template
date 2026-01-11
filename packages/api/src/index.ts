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
      logger.log({
        label: 'server started',
        body: `Server is running on http://localhost:${info.port}`
      })
      if (ENV.local) {
        ;(async () => {
          const [path, fs] = await Promise.all([
            import('node:path'),
            import('node:fs')
          ])

          const portFile = path.resolve(import.meta.dirname, '../.server-port')
          await fs.promises.writeFile(portFile, String(info.port))
          logger.log({ body: `output port file: ${portFile}` })
        })()
      }
    }
  )
}
main().catch((e) => {
  logger.error({ label: 'server error', body: 'error', error: e })
})

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
