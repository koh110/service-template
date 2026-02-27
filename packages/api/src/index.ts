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
      port: PORT,
      hostname: '0.0.0.0'
    },
    (info) => {
      logger.log({
        label: 'server started',
        body: `Server is running on http://localhost:${info.port}`
      })
      if (ENV.local) {
        const localProxyConfigDir = process.env.LOCAL_PROXY_CONFIG_DIR
        if (!localProxyConfigDir) {
          logger.error({
            label: 'server error',
            body: 'LOCAL_PROXY_CONFIG_DIR is not set in local environment'
          })
          return
        }
        ;(async () => {
          const [path, fs] = await Promise.all([
            import('node:path'),
            import('node:fs')
          ])
          const proxyDir = path.resolve(localProxyConfigDir)
          const apiFile = path.resolve(proxyDir, 'api.json')
          const apiTmpFile = path.resolve(proxyDir, 'api.json.tmp')
          const apiContent = JSON.stringify({ port: info.port })
          await fs.promises.writeFile(apiTmpFile, apiContent, {
            encoding: 'utf-8'
          })
          await fs.promises.rename(apiTmpFile, apiFile)
          logger.log({ body: `output proxy api file: ${apiFile}` })
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
