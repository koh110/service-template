import { PrismaClient } from 'shared/src/index'
import { DATABASE } from '../config.js'

export { Prisma } from 'shared/src/index'

export function createClient() {
  return new PrismaClient({
    datasourceUrl: DATABASE.url
  })
}
