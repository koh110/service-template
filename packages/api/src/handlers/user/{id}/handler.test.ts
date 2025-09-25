import { Prisma } from 'shared/src/index'
import { test as baseTest, beforeAll, expect } from 'vitest'
import { getTestDbClient, truncateTables } from '../../../../test/util.js'
import { updateUser } from './handler.js'

let dbClient: ReturnType<typeof getTestDbClient>

beforeAll(async () => {
  dbClient = getTestDbClient(process.env)
  await dbClient.$connect()
  await truncateTables(dbClient, [Prisma.ModelName.user])
  return async () => {
    await dbClient.$disconnect()
  }
})

const userSeedArgs = Prisma.validator<Prisma.userDefaultArgs>()({})
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

test('updateUser: success', async ({ seeds }) => {
  const target = seeds.users[0]
  const before = await dbClient.user.findFirst({ where: { id: target.id } })

  const updateValue = 'updated_name'
  await updateUser({ dbClient, id: target.id, body: { name: updateValue } })

  const after = await dbClient.user.findFirst({ where: { id: target.id } })
  expect(before!.name).not.toBe(after!.name)
  expect(after!.name).toBe(updateValue)
})

test('updateUser: undefined', async ({ seeds }) => {
  const target = seeds.users[0]
  const before = await dbClient.user.findFirst({ where: { id: target.id } })

  await updateUser({ dbClient, id: target.id, body: { name: undefined } })

  const after = await dbClient.user.findFirst({ where: { id: target.id } })
  expect(before!.name).toBe(after!.name)
})
