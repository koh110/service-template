export * as schema from './generated/schema.js'
export {
  Prisma,
  PrismaClient
} from './generated/prisma/index.js'

type Success<T> = { ok: true; status: number; body: T }
type Error<U = string> = { ok: false; status: number; body: U }
export type Result<T, U = string> = Success<T> | Error<U>
