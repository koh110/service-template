import path from 'node:path'
import fs from 'node:fs/promises'
import { parseEnv } from 'node:util'

export async function initLocal() {
  console.log('Initializing local environment...')
  await Promise.all([initApi(), initClient(), initShared()])
  console.log('Local environment initialized successfully.')
}

async function initApi() {
  console.log('setup api...')
  const targetPath = path.resolve(import.meta.dirname, '../../../api')
  const envSample = await fs.readFile(path.resolve(targetPath, '.env.sample'), 'utf-8')
  const env = {
    ...parseEnv(envSample)
  }
  const envStrs = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  await fs.writeFile(path.resolve(targetPath, '.env'), envStrs.join('\n'), 'utf-8')
  console.log('complete setup api...')
}

async function initClient() {
  console.log('setup client...')
  const targetPath = path.resolve(import.meta.dirname, '../../../client')
  const envSample = await fs.readFile(path.resolve(targetPath, '.env.local.sample'), 'utf-8')
  const env = {
    ...parseEnv(envSample)
  }
  const envStrs = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  await fs.writeFile(path.resolve(targetPath, '.env.local'), envStrs.join('\n'), 'utf-8')
  console.log('complete setup client...')
}

async function initShared() {
  console.log('setup shared...')
  const targetPath = path.resolve(import.meta.dirname, '../../../shared')
  const envSample = await fs.readFile(path.resolve(targetPath, '.env.sample'), 'utf-8')
  const env = {
    ...parseEnv(envSample)
  }
  const envStrs = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  await fs.writeFile(path.resolve(targetPath, '.env'), envStrs.join('\n'), 'utf-8')
  console.log('complete setup shared...')
}
