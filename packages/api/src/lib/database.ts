import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from 'shared/src/index'
import { DATABASE } from '../config.js'

export { Prisma } from 'shared/src/index'

export function createClient() {
  const adapter = new PrismaPg({ connectionString: DATABASE.url })
  return new PrismaClient({ adapter })
}
