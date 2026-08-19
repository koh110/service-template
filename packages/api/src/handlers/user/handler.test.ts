import { Prisma } from 'shared/src/prisma'
import { test as baseTest, beforeAll, expect } from 'vite-plus/test'
import { createUserSeed } from '../../../test/seeds/index.js'
import { getTestDbClient, truncateTables } from '../../../test/util.js'
import { listUser } from './handler.js'

let dbClient: Awaited<ReturnType<typeof getTestDbClient>>

beforeAll(async () => {
  dbClient = await getTestDbClient(process.env)
  await dbClient.$connect()
  await truncateTables(dbClient, [Prisma.ModelName.user])
  return async () => {
    await dbClient.$disconnect()
  }
})

const userSeedArgs = {} satisfies Prisma.userDefaultArgs
const test = baseTest.extend<{
  seeds: {
    count: number
    users: Prisma.userGetPayload<typeof userSeedArgs>[]
  }
}>({
  seeds: async ({ task }, use) => {
    const data = [
      createUserSeed({ name: 'user1' }, task.id),
      createUserSeed({ name: 'user2' }, task.id)
    ] satisfies Prisma.userCreateManyArgs['data']

    const res = await dbClient.user.createMany({ data })

    const users = await dbClient.user.findMany({
      where: {
        name: {
          in: data.map((e) => e.name)
        }
      }
    })

    await use({ count: res.count ?? 0, users })
  }
})

test('listUser', async ({ seeds }) => {
  const res = await listUser({ dbClient })
  expect(res.count).toBe(seeds.count)
  expect(res.user.length).toBe(seeds.count)
})
