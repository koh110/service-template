import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from 'shared/src/prisma'

export function createClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}
