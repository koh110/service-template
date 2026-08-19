import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from 'shared/src/prisma'
import type { TestProject } from 'vite-plus/test/node'
import { getTestDbName, getTestDbParameters } from './util.js'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const prismaCli = require.resolve('prisma/build/index.js')
const PRISMA_COMMAND_TIMEOUT_MS = 60_000
const PRISMA_COMMAND_MAX_BUFFER = 1024 * 1024

export async function setup({ config }: TestProject) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!')
  }

  process.env.DATABASE_URL = 'postgres://xxxx'
  // localTokenVerifier 等の認証スタブは APP_ENV=local/test でのみ動作する
  // (production への fail-closed のため)。テスト実行時は test を明示する。
  process.env.APP_ENV = 'test'

  const { testDbUrl } = await getTestDbParameters(process.env)
  const rootTestDatabaseName =
    process.env.TEST_DB_ROOT_DATABASE_NAME ?? 'test_db'

  const ROOT_TEST_DATABASE_URL = `${testDbUrl}/${rootTestDatabaseName}`
  console.log('[setup] rootTestDatabaseUrl:', ROOT_TEST_DATABASE_URL)
  const adapter = new PrismaPg({ connectionString: ROOT_TEST_DATABASE_URL })
  const rootClient = new PrismaClient({ adapter })

  const maxWorkers = config?.maxWorkers ?? 1
  console.log('[setup] maxWorkers:', maxWorkers)

  const databaseNames = Array.from({ length: maxWorkers }, (_, index) => {
    return getTestDbName(`${index + 1}`)
  })

  try {
    await Promise.all(
      databaseNames.map((databaseName) => {
        return rootClient.$executeRawUnsafe(
          `DROP DATABASE IF EXISTS "${databaseName}"`
        )
      })
    )
  } finally {
    await rootClient.$disconnect()
  }

  await Promise.all(
    databaseNames.map((databaseName) => {
      return runMigrate({ databaseUrl: testDbUrl, databaseName })
    })
  )
}

async function runMigrate({
  databaseUrl,
  databaseName
}: {
  databaseUrl: string
  databaseName: string
}) {
  console.log('[runMigrate] migrate start:', databaseName)
  // execFile(配列引数) + prisma CLI のエントリポイント直接指定により、
  // シェル経由の文字列連結(exec + npx)を避ける。stderr は警告等でも
  // 出ることがあるため、成功判定には使わない(非ゼロ終了時は execFile が reject する)
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'dev'], {
    cwd: path.join(import.meta.dirname, '../../shared'),
    timeout: PRISMA_COMMAND_TIMEOUT_MS,
    maxBuffer: PRISMA_COMMAND_MAX_BUFFER,
    env: {
      ...process.env,
      DATABASE_URL: `${databaseUrl}/${databaseName}`
    }
  })
  console.log('[runMigrate] migrate done')
}
