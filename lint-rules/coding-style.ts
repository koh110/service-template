/**
 * パッケージ横断のコーディング規約(agents/lint-rules.md)を機械的に強制するための
 * oxlint JS plugin。ルート vite.config.ts の `lint.jsPlugins` から読み込まれる。
 * api handler 固有の契約は `index.ts`(プラグイン名 `api-contract`)側に置く。
 */
import type { Plugin } from './types.ts'
import { enforceZodEntrypointRule } from './rules/enforce-zod-entrypoint.ts'
import { noProcessEnvOutsideConfigRule } from './rules/no-process-env-outside-config.ts'

const plugin: Plugin = {
  meta: {
    name: 'coding-style'
  },
  rules: {
    'no-process-env-outside-config': noProcessEnvOutsideConfigRule,
    'enforce-zod-entrypoint': enforceZodEntrypointRule
  }
}

export default plugin
