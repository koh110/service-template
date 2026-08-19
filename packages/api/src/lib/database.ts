import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from 'shared/src/prisma'
import { DATABASE } from '../config.js'

export { Prisma } from 'shared/src/prisma'

export function createClient() {
  const adapter = new PrismaPg({ connectionString: DATABASE.url })
  return new PrismaClient({ adapter })
}
