import type { TestProject } from 'vitest/node'
import { exec } from 'node:child_process'
import path from 'node:path'
import { PrismaClient } from 'shared/src/index'
import { getTestDbParameters, getTestDbName } from './util.js'

export async function setup({ config }: TestProject) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!')
  }

  process.env.DATABASE_URL = 'postgres://xxxx'

  const { testDbUrl } = getTestDbParameters(process.env)
  const rootTestDatabaseName =
    process.env.TEST_DB_ROOT_DATABASE_NAME ?? 'test_db'

  const ROOT_TEST_DATABASE_URL = `${testDbUrl}/${rootTestDatabaseName}`
  console.log('[setup] rootTestDatabaseUrl:', ROOT_TEST_DATABASE_URL)
  const rootClient = new PrismaClient({
    datasourceUrl: ROOT_TEST_DATABASE_URL
  })

  const maxPool = config.poolOptions?.threads?.maxThreads ?? 1
  console.log('[setup] maxPool:', maxPool)

  const promises: ReturnType<typeof runMigrate>[] = []
  for (let i = 1; i <= maxPool; i++) {
    const databaseName = getTestDbName(`${i}`)
    promises.push(
      runMigrate({
        rootClient,
        databaseUrl: testDbUrl,
        databaseName
      })
    )
  }
  await Promise.all(promises)

  await rootClient.$disconnect()
}

async function runMigrate({
  rootClient,
  databaseUrl,
  databaseName
}: {
  rootClient: PrismaClient
  databaseUrl: string
  databaseName: string
}) {
  console.log('[runMigrate] migrate start:', databaseName)
  await rootClient.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS "${databaseName}"`
  )

  const DATABASE_URL = `${databaseUrl}/${databaseName}`
  await new Promise((resolve, reject) => {
    try {
      exec(
        `DATABASE_URL=${DATABASE_URL} npx prisma migrate dev`,
        {
          cwd: path.join(import.meta.dirname, '../../shared'),
          timeout: 60000,
          env: process.env
        },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`[runMigrate] migrate error: ${error.message}`)
            reject(error)
          } else if (stderr) {
            console.warn(`[runMigrate] migrate stderr: ${stderr}`)
            resolve(new Error(stderr))
          } else {
            console.log(`[runMigrate] migrate done`)
            resolve(stdout)
          }
        }
      )
    } catch (error) {
      console.error(`[runMigrate] migrate error`, error)
      reject(error)
    }
  })
}
