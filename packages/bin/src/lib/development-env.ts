import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { fetchDbPort, fetchProxyPort } from './docker-compose.ts'

const PACKAGES = ['api', 'client', 'shared'] as const

const { values } = parseArgs({
  options: {
    'override-env': { type: 'string', multiple: true, short: 'o' },
    command: { type: 'string', short: 'c' }
  },
  strict: false
})

export async function developmentEnv(_packageName: string | undefined) {
  const packageName = PACKAGES.find((e) => e === (_packageName || '').trim())
  if (!packageName) {
    console.error(`package name: "${_packageName}" not found`)
    process.exit(1)
  }

  const overrideEnv: Record<string, string> = {}
  if (values['override-env']) {
    for (const entry of values['override-env'] as string[]) {
      if (!entry.includes('=')) {
        console.error(`Invalid override-env entry: "${entry}"`)
        process.exit(1)
      }
      const [key, value] = entry.split('=')
      if (key && value) {
        overrideEnv[key] = value
      }
    }
  }

  switch (packageName) {
    case 'api':
      await api(overrideEnv)
      break
    case 'client':
      await client(overrideEnv)
      break
    case 'shared':
      await shared(overrideEnv)
      break
  }
}

async function api(overrideEnv: Record<string, string>) {
  const targetDir = path.resolve(import.meta.dirname, '../../../api')
  const envFilePath = path.resolve(targetDir, '.env.sample')
  const envSample = await fs.readFile(envFilePath, 'utf-8')
  const parsedEnv = parseEnv(envSample)

  const [dbPort] = await Promise.all([fetchDbPort()])
  if (!dbPort) {
    throw new Error('Failed to fetch database port.')
  }

  if (parsedEnv.DATABASE_URL) {
    const dbUrl = new URL(parsedEnv.DATABASE_URL)
    dbUrl.port = dbPort
    parsedEnv.DATABASE_URL = dbUrl.toString()
  }

  const LOCAL_PROXY_CONFIG_DIR = path.resolve(
    import.meta.dirname,
    '../../../../middleware/nginx/dynamic'
  )

  const env = {
    ...parsedEnv,
    LOCAL_PROXY_CONFIG_DIR,
    ...overrideEnv
  } as const satisfies NodeJS.Dict<string>

  writeEnvToStdout(env)
}

async function shared(overrideEnv: Record<string, string>) {
  const targetDir = path.resolve(import.meta.dirname, '../../../shared')
  const envFilePath = path.resolve(targetDir, '.env.sample')
  const envSample = await fs.readFile(envFilePath, 'utf-8')
  const parsedEnv = parseEnv(envSample)
  const dbPort = await fetchDbPort()
  if (!dbPort) {
    throw new Error('Failed to fetch database port.')
  }

  if (parsedEnv.DATABASE_URL) {
    const dbUrl = new URL(parsedEnv.DATABASE_URL)
    dbUrl.port = dbPort
    parsedEnv.DATABASE_URL = dbUrl.toString()
  }

  const env = {
    ...parsedEnv,
    ...overrideEnv
  } as const satisfies NodeJS.Dict<string>

  writeEnvToStdout(env)
}

async function client(overrideEnv: Record<string, string>) {
  const targetDir = path.resolve(import.meta.dirname, '../../../client')
  const envFilePath = path.resolve(targetDir, '.env.local.sample')
  const envSample = await fs.readFile(envFilePath, 'utf-8')
  const parsedEnv = parseEnv(envSample)
  const [proxyPort] = await Promise.all([fetchProxyPort()])
  if (!proxyPort) {
    throw new Error('Failed to fetch proxy port.')
  }
  const API_URI = `http://localhost:${proxyPort}`

  const env = {
    ...parsedEnv,
    API_URI,
    ...overrideEnv
  } as const satisfies NodeJS.Dict<string>

  writeEnvToStdout(env)
}

function writeEnvToStdout(env: NodeJS.Dict<string>) {
  const envStrs = Object.entries(env).map(([key, value]) => {
    if (!value) {
      return ''
    }
    const escaped = value
      .replace(/'/g, "'\\''") // ' を '\'' に変換
      .replace(/^"/, '') // 先頭の " を削除
      .replace(/"$/, '') // 末尾の " を削除
      .replace(/\n/g, '\\n') // 改行を \n に変換
    return `export ${key}=$'${escaped}'`
  })
  process.stdout.write(envStrs.join('\n'))
}
