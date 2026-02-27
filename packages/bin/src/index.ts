#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { developmentEnv } from './lib/development-env.ts'
import { initLocal } from './lib/init-local.ts'

const { positionals } = parseArgs({
  strict: false,
  allowPositionals: true,
  options: {}
})

async function main() {
  if (positionals[0] === 'init-local') {
    return await initLocal()
  }
  if (positionals[0] === 'env') {
    const [, packageName] = positionals
    return await developmentEnv(packageName)
  }
  if (positionals[0] === 'docker-compose') {
    const [, ...command] = positionals
    const { dockerCompose } = await import('./lib/docker-compose.ts')
    const res = await dockerCompose(command.map((e) => e.trim()).join(' '))
    process.stdout.write(res.stdout)
    process.stderr.write(res.stderr)
    return
  }
}
main().catch(console.error)
