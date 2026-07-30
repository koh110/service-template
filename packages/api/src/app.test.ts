import { beforeAll, expect, test, vi } from 'vitest'
import { getTestDbClient } from '../test/util.js'
import { createApp } from './app.js'

let dbClient: Awaited<ReturnType<typeof getTestDbClient>>

beforeAll(async () => {
  dbClient = await getTestDbClient(process.env)
  await dbClient.$connect()

  return async () => {
    await dbClient.$disconnect()
  }
})

vi.mock('./lib/database.js', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('./lib/database.js')>()),
    createClient: () => dbClient
  }
})

test('unmatched routes return an RFC 9457 problem details 404', async () => {
  const app = await createApp()
  const res = await app.request('/no-such-route')

  expect(res.status).toBe(404)
  expect(await res.json()).toStrictEqual({
    type: 'about:blank',
    title: 'Not Found',
    status: 404
  })
})

test('missing Authorization header returns an RFC 9457 problem details 401', async () => {
  const app = await createApp()
  const res = await app.request('/api/user')

  expect(res.status).toBe(401)
  expect(await res.json()).toStrictEqual({
    type: 'about:blank',
    title: 'Unauthorized',
    status: 401,
    detail: 'Authorization error'
  })
})

test('handler errors after successful authentication are not swallowed as 401', async () => {
  const app = await createApp()
  const res = await app.request('/api/user/999999999', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })

  expect(res.status).toBe(404)
  expect(await res.json()).toStrictEqual({
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: 'User not found'
  })
})
