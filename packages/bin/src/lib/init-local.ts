import cp from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(cp.exec)

export async function initLocal() {
  // docker compose のproject nameをdynamicに設定するための.envを作成
  const targetPath = path.resolve(import.meta.dirname, '../../../../.env')
  const gitBranchName = await execAsync('git rev-parse --abbrev-ref HEAD')
  const replaced = gitBranchName.stdout.trim().replace(/\//g, '-')
  const dockerProjectName = `project-template-${replaced}`

  const env = {
    COMPOSE_PROJECT_NAME: dockerProjectName
  }
  const envStrs = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  await fs.writeFile(targetPath, envStrs.join('\n'), 'utf-8')
  console.log('Local environment initialized successfully.')
}
