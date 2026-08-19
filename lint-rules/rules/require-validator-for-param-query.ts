/**
 * `<expr>.req.param(...)` / `<expr>.req.query(...)` の直接呼び出しを検出するルール。
 *
 * これらは Hono が受け取った生の string 値をそのまま返すため、zod によるバリデーションを
 * 一切経ずに使われてしまう。`validator('param' | 'query', (value, c) => {...})` を定義し、
 * `c.req.valid('param' | 'query')` 経由で取得すべき(agents/api-contract.md 参照)。
 */
import type { CallExpressionNode, MemberExpressionNode, Rule } from '../types.ts'

const TARGET_METHODS = new Set(['param', 'query'])

const MESSAGE =
  'c.req.param()/c.req.query() を validator() を経由せず直接呼び出さないでください。validator() を定義し c.req.valid() 経由で取得してください(agents/api-contract.md 参照)'

function isReqMemberAccess(node: MemberExpressionNode): boolean {
  if (node.computed) {
    return false
  }
  return node.property.type === 'Identifier' && node.property.name === 'req'
}

function isDirectReqParamOrQueryCall(node: CallExpressionNode): boolean {
  const { callee } = node
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false
  }
  if (callee.property.type !== 'Identifier' || !TARGET_METHODS.has(callee.property.name)) {
    return false
  }
  const receiver = callee.object
  return receiver.type === 'MemberExpression' && isReqMemberAccess(receiver)
}

export const requireValidatorForParamQueryRule: Rule = {
  meta: {
    docs: {
      description:
        'req.param()/req.query() の直接呼び出しを禁止し validator 経由の利用を必須化する'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isDirectReqParamOrQueryCall(node)) {
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
