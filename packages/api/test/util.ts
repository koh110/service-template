import cp from 'node:child_process'
import { promisify } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { type Prisma, PrismaClient } from 'shared/src/index'

const execAsync = promisify(cp.exec)

export function getTestDbName(suffix: string) {
  return `test_${suffix}`
}

export async function getTestDbParameters(env: NodeJS.ProcessEnv) {
  const host = process.env.TEST_DB_HOST ?? 'localhost'
  const user = process.env.TEST_DB_USER ?? 'test_username'
  const password = process.env.TEST_DB_PASSWORD ?? 'test_randompassword'
  const port = await (async () => {
    if (process.env.TEST_DB_PORT) {
      return Number(process.env.TEST_DB_PORT)
    }
    const { stdout } = await execAsync(
      `npm run -s docker-compose -w bin -- port test-db 5432`
    )
    const parts = stdout.trim().split(':')
    return Number(parts[1])
  })()
  const testDbName = env.VITEST_POOL_ID
    ? getTestDbName(env.VITEST_POOL_ID)
    : null

  return {
    user,
    password,
    host,
    port,
    testDbUrl: `postgresql://${user}:${password}@${host}:${port}`,
    testDbName
  }
}

export async function getTestDbClient(env: NodeJS.ProcessEnv) {
  const { user, password, host, port, testDbName } =
    await getTestDbParameters(env)
  const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${testDbName}`
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  return new PrismaClient({ adapter })
}

export async function truncateTables(
  dbClient: PrismaClient,
  tables: (typeof Prisma.ModelName)[keyof typeof Prisma.ModelName][]
) {
  const tableNames = tables.map((table) => `"${table}"`).join(', ')
  await dbClient.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE`)
}
