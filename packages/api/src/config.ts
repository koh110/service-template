import type { cors } from 'hono/cors'

type CORS_OPTIONS = Parameters<typeof cors>[0]

export const ENV = {
  production: process.env.APP_ENV === 'production',
  test: process.env.APP_ENV === 'test',
  local: process.env.APP_ENV === 'local'
} as const

export const PORT = process.env.PORT ? Number(process.env.PORT) : 0

export const CORS_OPTIONS: CORS_OPTIONS = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((e) => e.trim())
    : // worktree を使うと複数の client dev server が localhost:3000 以降の
      // 連番ポートで並行起動しうるため、未指定時はその範囲を許可しておく
      Array.from({ length: 10 }).map((_, i) => {
        const port = 3000 + i
        return `http://localhost:${port}`
      })
} as const

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined')
}

export const DATABASE = {
  url: process.env.DATABASE_URL
} as const
