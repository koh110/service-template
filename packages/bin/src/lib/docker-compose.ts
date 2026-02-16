import cp from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(cp.exec)

export async function dockerCompose(command: string | undefined) {
  if (!command) {
    throw new Error('command is required')
  }
  const composeDir = path.resolve(import.meta.dirname, '../../../../')
  const composeFile = path.resolve(composeDir, 'compose.yaml')
  const dockerOptions = [`-f ${composeFile}`].filter(Boolean).join(' ')
  const res = await execAsync(`docker compose ${dockerOptions} ${command}`, {
    cwd: composeDir
  })
  return res
}

export async function fetchDbPort() {
  const res = await dockerCompose('port db 5432')
  return extractPort(res.stdout)
}

export async function fetchEnvoyPort() {
  const res = await dockerCompose('port envoy 8000')
  return extractPort(res.stdout)
}

function extractPort(output: string) {
  const trimmed = output.trim()
  const segments = trimmed.split(':')
  return segments[segments.length - 1] ?? ''
}
