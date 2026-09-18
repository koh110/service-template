import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vite-plus/test'

const styles = fs.readFileSync(path.join(process.cwd(), 'app/styles.css'), 'utf8')

test('dashboard visual tokens and responsive layout are explicit', () => {
  expect(styles).toContain('--bg: #101418')
  expect(styles).toContain('--panel: #1a2027')
  expect(styles).toContain('--online: #34c176')
  expect(styles).toContain('@media (min-width: 640px)')
  expect(styles).toContain('@media (max-width: 480px)')
  expect(styles).toContain('overflow-wrap: anywhere')
})
