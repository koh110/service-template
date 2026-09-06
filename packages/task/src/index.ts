import { parseArgs } from 'node:util'
import { logger } from './lib/logger/index.js'

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false
})

async function main() {
  const command = positionals[0]
  logger.log({ label: 'task', body: 'start', meta: { command } })

  switch (command) {
    case 'migrate': {
      const { migrate } = await import('./tasks/migrate.js')
      await migrate()
      break
    }
    case 'hello': {
      const { loadDatabaseConfig } = await import('./config.js')
      const { createClient } = await import('./lib/database.js')
      const { hello } = await import('./tasks/hello.js')
      const { url } = loadDatabaseConfig()
      const dbClient = createClient(url)
      try {
        const message = await hello({
          dbClient,
          name: positionals[1] ?? 'world'
        })
        logger.log({ label: 'hello', body: message })
      } finally {
        await dbClient.$disconnect()
      }
      break
    }
    default:
      throw new Error(`unknown task: ${command}`)
  }

  logger.log({ label: 'task', body: 'done', meta: { command } })
}

main().catch((error) => {
  logger.error({ label: 'task', body: 'failed', error })
  process.exit(1)
})
