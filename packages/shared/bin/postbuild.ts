import path from 'node:path'
import { cp } from 'node:fs/promises'

async function main() {
  const src = path.resolve(import.meta.dirname, '../src/generated/prisma')
  const dest = path.resolve(import.meta.dirname, '../dist/src/generated/prisma')
  await cp(src, dest, {
    recursive: true,
    force: true
  })
}
main().catch(console.error)
