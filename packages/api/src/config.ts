import type { cors } from 'hono/cors'

type CORS_OPTIONS = Parameters<typeof cors>[0]

export const ENV = {
  production: process.env.APP_ENV === 'production',
  test: process.env.APP_ENV === 'test',
  local: process.env.APP_ENV === 'local'
} as const

export const PORT = process.env.PORT ? Number(process.env.PORT) : 8000

export const CORS_OPTIONS: CORS_OPTIONS = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((e) => e.trim())
    : ['http://localhost:3000']
} as const
