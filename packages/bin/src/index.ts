#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { initLocal } from './lib/init-local.ts'

const { positionals, values } = parseArgs({
  strict: false,
  allowPositionals: true,
  options: {}
})

async function main() {
  if (positionals[0] === 'init-local') {
    await initLocal()
  }
}
main().catch(console.error)
