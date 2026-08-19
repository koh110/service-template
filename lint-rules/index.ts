/**
 * api の handler 実装規約(agents/api-contract.md)を機械的に強制するための
 * oxlint JS plugin。ルート vite.config.ts の `lint.jsPlugins` から読み込まれる。
 */
import type { Plugin } from './types.ts'
import { requireHttpExceptionResRule } from './rules/require-httpexception-res.ts'
import { requireValidatorForParamQueryRule } from './rules/require-validator-for-param-query.ts'
import { requireValidatorReturnTypeRule } from './rules/require-validator-return-type.ts'

const plugin: Plugin = {
  meta: {
    name: 'api-contract'
  },
  rules: {
    'require-validator-return-type': requireValidatorReturnTypeRule,
    'require-httpexception-res': requireHttpExceptionResRule,
    'require-validator-for-param-query': requireValidatorForParamQueryRule
  }
}

export default plugin
