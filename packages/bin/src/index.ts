#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { developmentEnv } from './lib/development-env.ts'
import { initLocal } from './lib/init-local.ts'

const { positionals, tokens } = parseArgs({
  strict: false,
  allowPositionals: true,
  options: {},
  tokens: true
})

// `docker-compose` サブコマンドに渡す引数を、parseArgs が消費したトークン列から
// 生の表記(rawName)のまま復元する。values だけを使うと `-d` と `--d` の区別や
// 引数の順序が失われ、docker compose にそのまま渡せる形に戻せないため。
function argsFrom(fromIndex: number) {
  const args: string[] = []
  for (const token of tokens) {
    if (token.index < fromIndex) {
      continue
    }
    if (token.kind === 'positional') {
      args.push(token.value)
    } else if (token.kind === 'option') {
      args.push(token.inlineValue ? `${token.rawName}=${token.value}` : token.rawName)
    } else if (token.kind === 'option-terminator') {
      args.push('--')
    }
  }
  return args
}

async function main() {
  if (positionals[0] === 'init-local') {
    return await initLocal()
  }
  if (positionals[0] === 'env') {
    const [, packageName] = positionals
    return await developmentEnv(packageName)
  }
  if (positionals[0] === 'docker-compose') {
    const rawArgs = argsFrom(1)
    const { runDockerCompose } = await import('./lib/docker-compose.ts')
    process.exitCode = await runDockerCompose(rawArgs)
    return
  }
}
main().catch(console.error)
