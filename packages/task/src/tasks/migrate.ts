import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from '../lib/logger/index.js'

const execFileAsync = promisify(execFile)

export async function migrate() {
  const { stdout, stderr } = await execFileAsync('npm', [
    'run',
    'db-migrate:deploy',
    '-w',
    'shared'
  ])
  if (stdout) {
    logger.log({ label: 'migrate', body: stdout })
  }
  if (stderr) {
    logger.log({ label: 'migrate', body: stderr })
  }
}
