import cp from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(cp.exec)

export async function initLocal() {
  // docker compose のproject nameをdynamicに設定するための.envを作成
  const repoRoot = path.resolve(import.meta.dirname, '../../../../')
  const targetPath = path.resolve(repoRoot, '.env')
  const gitBranchName = await execAsync('git rev-parse --abbrev-ref HEAD')
  const replaced = gitBranchName.stdout.trim().replace(/\//g, '-')
  // 同じブランチ名を別の worktree/clone で同時に動かしても
  // compose の project(= volume/container/network)が衝突しないよう、
  // リポジトリの絶対パスから作った短いハッシュを混ぜる
  const pathHash = createHash('sha256')
    .update(repoRoot)
    .digest('hex')
    .slice(0, 8)
  const dockerProjectName = `project-template-${replaced}-${pathHash}`

  const env = {
    COMPOSE_PROJECT_NAME: dockerProjectName
  }
  const envStrs = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  await fs.writeFile(targetPath, envStrs.join('\n'), 'utf-8')
  console.log('Local environment initialized successfully.')
}
