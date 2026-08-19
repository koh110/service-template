import { randomUUID } from 'node:crypto'
import { Prisma } from 'shared/src/prisma'

export function createUserSeed(
  seed: Partial<Prisma.$userPayload['scalars']>,
  prefix: string = ''
) {
  const random = randomUUID()
  const now = new Date()

  return {
    name: seed.name ? `${prefix}_${seed.name}` : `${prefix}_${random}`,
    created_at: seed.created_at ?? now,
    updated_at: seed.updated_at ?? now
  } satisfies Omit<Prisma.$userPayload['scalars'], 'id'>
}
