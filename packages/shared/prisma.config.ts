import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { defineConfig } from 'prisma/config'

const { DATABASE_URL } = await (async () => {
  if (process.env.DATABASE_URL) {
    return {
      DATABASE_URL: process.env.DATABASE_URL
    }
  }
  try {
    const envFilePath = resolve(import.meta.dirname, '.env')
    const exist = await stat(envFilePath)
    if (exist.isFile()) {
      const envFile = await readFile(envFilePath, 'utf-8')
      const env = parseEnv(envFile)
      return {
        DATABASE_URL: env.DATABASE_URL ?? ''
      }
    }
    return {
      DATABASE_URL: ''
    }
  } catch (_e) {
    return {
      DATABASE_URL: ''
    }
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
