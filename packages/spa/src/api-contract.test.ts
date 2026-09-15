import { expect, test } from 'vite-plus/test'
import { parseUserResponse } from './api-contract'

test('runtime contract accepts the generated API shape', () => {
  const parsed = parseUserResponse({
    count: 1,
    user: [
      {
        id: 1,
        name: 'Alice',
        created_at: 1710000000,
        updated_at: 1710003600
      }
    ]
  })

  expect(parsed).toEqual({
    count: 1,
    user: [
      {
        id: 1,
        name: 'Alice',
        created_at: 1710000000,
        updated_at: 1710003600
      }
    ]
  })
})

test('count mismatch and invalid timestamps are rejected', () => {
  expect(
    parseUserResponse({
      count: 2,
      user: [{ id: 1, name: 'Alice', created_at: 1710000000, updated_at: 1710003600 }]
    })
  ).toBeNull()
  expect(
    parseUserResponse({
      count: 1,
      user: [{ id: 1, name: 'Alice', created_at: -1, updated_at: 1710003600 }]
    })
  ).toBeNull()
})
