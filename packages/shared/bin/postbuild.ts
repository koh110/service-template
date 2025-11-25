import { cp } from 'node:fs/promises'
import path from 'node:path'

async function main() {
  const src = path.resolve(import.meta.dirname, '../src/generated/prisma')
  const dest = path.resolve(import.meta.dirname, '../dist/src/generated/prisma')
  await cp(src, dest, {
    recursive: true,
    force: true
  })
}
main().catch(console.error)
