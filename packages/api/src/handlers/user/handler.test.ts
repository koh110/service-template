import { Prisma } from 'shared/src/index'
import { test as baseTest, beforeAll, expect } from 'vitest'
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
      { name: `${task.id}_user1` },
      { name: `${task.id}_user2` }
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
