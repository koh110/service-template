import { PrismaPg } from '@prisma/adapter-pg'
import { type Prisma, PrismaClient } from 'shared/src/index'

export function getTestDbName(suffix: string) {
  return `test_${suffix}`
}

export function getTestDbParameters(env: NodeJS.ProcessEnv) {
  const host = process.env.TEST_DB_HOST ?? 'localhost'
  const user = process.env.TEST_DB_USER ?? 'test_username'
  const password = process.env.TEST_DB_PASSWORD ?? 'test_randompassword'
  const port = process.env.TEST_DB_PORT
    ? Number(process.env.TEST_DB_PORT)
    : 5433
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

export function getTestDbClient(env: NodeJS.ProcessEnv) {
  const { user, password, host, port, testDbName } = getTestDbParameters(env)
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
