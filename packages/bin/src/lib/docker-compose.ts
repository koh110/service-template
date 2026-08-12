import cp from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(cp.exec)

const composeDir = path.resolve(import.meta.dirname, '../../../../')
const composeFile = path.resolve(composeDir, 'compose.yaml')

// fetchDbPort/fetchProxyPort 専用。stdout をパースして DATABASE_URL/API_URI を
// 組み立てるため、標準出力を「捕捉」する必要がある(runDockerCompose の inherit とは
// 用途が異なるので混同しないこと)。
export async function dockerCompose(command: string | undefined) {
  if (!command) {
    throw new Error('command is required')
  }
  const res = await execAsync(`docker compose -f ${composeFile} ${command}`, {
    cwd: composeDir
  })
  return res
}

// `docker-compose <...>` CLI サブコマンド専用。node:util の parseArgs は
// strict:false でも `-d`/`--wait` のような未知フラグを values 側に吸ってしまい
// positionals から消えるため、ここでは生の argv をそのまま渡す。
// `up`(フォアグラウンド)のように終了しないコマンドもあるので、
// exec(バッファ完了待ち)ではなく spawn + stdio:'inherit' を使う。
export function runDockerCompose(args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = cp.spawn('docker', ['compose', '-f', composeFile, ...args], {
      cwd: composeDir,
      stdio: 'inherit'
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

export async function fetchDbPort() {
  const res = await dockerCompose('port db 5432')
  return extractPort(res.stdout)
}

export async function fetchProxyPort() {
  const res = await dockerCompose('port nginx 8000')
  return extractPort(res.stdout)
}

function extractPort(output: string) {
  const trimmed = output.trim()
  const segments = trimmed.split(':')
  return segments[segments.length - 1] ?? ''
}
