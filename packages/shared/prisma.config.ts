import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'prisma/config'

const { DATABASE_URL } = (() => {
  if (process.env.DATABASE_URL) {
    return {
      DATABASE_URL: process.env.DATABASE_URL
    }
  }
  const envFilePath = resolve(import.meta.dirname, '.env')
  const envFile = readFileSync(envFilePath, 'utf-8')
  const env = parseEnv(envFile)
  return {
    DATABASE_URL: env.DATABASE_URL ?? ''
  }
})()

export default defineConfig({
  schema: resolve(import.meta.dirname, 'prisma/schema.prisma'),
  migrations: { 
    path: resolve(import.meta.dirname, 'prisma/migrations')
  },
  datasource: {
    url: DATABASE_URL
  }
})
