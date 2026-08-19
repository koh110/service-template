/**
 * `process.env` の参照を config ファイルに集約させるルール。
 *
 * 環境変数を扱う処理は各パッケージの config(`config.ts` / `config.server.ts` 等)に
 * まとめる。config ファイルとテストファイル(seed 等で環境変数を参照する)は対象外。
 */
import type { MemberExpressionNode, Rule } from '../types.ts'

const CONFIG_FILE = /(^|\/)config(\.[\w-]+)*\.(ts|tsx|js|mjs|mts)$/
const TEST_FILE = /(\.test\.(ts|tsx)$|(^|\/)test\/)/

const MESSAGE =
  '環境変数の参照は config ファイル(config.ts / config.server.ts 等)に集約してください(agents/api-contract.md 参照)'

function isProcessEnvAccess(node: MemberExpressionNode): boolean {
  return (
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'env'
  )
}

export const noProcessEnvOutsideConfigRule: Rule = {
  meta: {
    docs: {
      description: 'process.env の参照を config ファイル以外で禁止する'
    }
  },
  create(context) {
    if (CONFIG_FILE.test(context.filename) || TEST_FILE.test(context.filename)) {
      return {}
    }
    return {
      MemberExpression(node) {
        if (!isProcessEnvAccess(node)) {
          return
        }

        context.report({
          node,
          message: MESSAGE
        })
      }
    }
  }
}
