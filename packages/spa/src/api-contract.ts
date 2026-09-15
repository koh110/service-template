import type { paths } from 'shared/src/schema'
import * as z from 'zod/mini'

export type UserResponse =
  paths['/api/user']['get']['responses']['200']['content']['application/json']

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.number(),
  updated_at: z.number()
})

const userResponseSchema = z.object({
  count: z.number(),
  user: z.array(userSchema)
})

function isSafeNonNegativeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0
}

function isValidTimestampSeconds(value: number) {
  if (!isSafeNonNegativeInteger(value)) {
    return false
  }
  return !Number.isNaN(new Date(value * 1000).getTime())
}

export function parseUserResponse(input: unknown) {
  const parsed = userResponseSchema.safeParse(input)
  if (!parsed.success) {
    return null
  }

  const data = parsed.data
  if (!isSafeNonNegativeInteger(data.count) || data.count !== data.user.length) {
    return null
  }

  for (const user of data.user) {
    if (
      !isSafeNonNegativeInteger(user.id) ||
      !isValidTimestampSeconds(user.created_at) ||
      !isValidTimestampSeconds(user.updated_at)
    ) {
      return null
    }
  }

  const response: UserResponse = data
  return response
}
