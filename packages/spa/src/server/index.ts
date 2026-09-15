import { assertDistribution, config } from './config.js'
import { createApplicationServer } from './static-server.js'

await assertDistribution(config.spaDistDir)

const application = createApplicationServer({ config })
const { server } = application

server.on('error', () => {
  process.exitCode = 1
})

function shutdown() {
  application.abortAll()
  server.close(() => {
    process.exit(0)
  })
  setTimeout(() => {
    process.exit(1)
  }, 10_000).unref()
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
server.listen(config.port, config.host)
