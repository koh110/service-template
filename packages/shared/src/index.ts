export { Prisma, PrismaClient } from './generated/prisma/client.js'
export * as schema from './generated/schema.js'

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

type Success<T> = { ok: true; status: number; body: T }
type Error<U = string> = { ok: false; status: number; body: U }
export type Result<T, U = string> = Success<T> | Error<U>
