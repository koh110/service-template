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
        const localEnvoyConfigDir = process.env.LOCAL_ENVOY_CONFIG_DIR
        if (!localEnvoyConfigDir) {
          logger.error({
            label: 'server error',
            body: 'LOCAL_ENVOY_CONFIG_DIR is not set in local environment'
          })
          return
        }
        ;(async () => {
          const [path, fs] = await Promise.all([
            import('node:path'),
            import('node:fs')
          ])
          const envoyDir = path.resolve(localEnvoyConfigDir)
          const cdsFile = path.resolve(envoyDir, 'cds.yaml')
          const cdsTmpFile = path.resolve(envoyDir, 'cds.yaml.tmp')
          const cdsContent = `version_info: "${Date.now()}"
resources:
  - "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
    name: api_cluster
    type: STRICT_DNS
    dns_lookup_family: V4_ONLY
    load_assignment:
      cluster_name: api_cluster
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: host.docker.internal
                    port_value: ${info.port}`
          await fs.promises.writeFile(cdsTmpFile, cdsContent, {
            encoding: 'utf-8'
          })
          await fs.promises.rename(cdsTmpFile, cdsFile)
          logger.log({ body: `output envoy cds file: ${cdsFile}` })
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
