import { expect, test } from 'vitest'
import { hello } from './hello.js'

test('hello greets by name and reports the user count', async () => {
  const dbClient = {
    user: {
      count: async () => 3
    }
  }

  const result = await hello({ dbClient, name: 'world' })

  expect(result).toBe('Hello, world! There are 3 user(s) in the database.')
})
