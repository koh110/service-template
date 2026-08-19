/**
 * hono/validator('json' | 'query' | 'param', fn) の fn(コールバック)に戻り値の型注釈を
 * 必須化するルール。
 *
 * Hono は fn の戻り値型から `c.req.valid()` の型を導出するため、この注釈だけが
 * 「validator の中身(zod スキーマ)の出力型が OpenAPI 生成型と一致しているか」を
 * tsc に機械的に照合させる唯一のポイントになる(agents/api-contract.md 参照)。
 *
 * fn が単一の識別子(named function への参照)の場合は対象外とする。関数を切り出した
 * 場合は、その関数宣言側で戻り値型注釈を付けることを別途徹底する必要があるが、
 * このルールは呼び出し箇所の AST だけからは追跡できないため検出対象外としている。
 */
import type { CallExpressionNode, Rule } from '../types.ts'

const TARGET_VALUES = new Set(['json', 'query', 'param'])

const MESSAGE =
  'hono/validator のコールバックには戻り値の型注釈を付け、OpenAPI 生成型と照合してください(agents/api-contract.md 参照)'

function isTargetValidatorCall(node: CallExpressionNode): boolean {
  const { callee } = node
  return callee.type === 'Identifier' && callee.name === 'validator'
}

export const requireValidatorReturnTypeRule: Rule = {
  meta: {
    docs: {
      description:
        'hono/validator のコールバックに戻り値の型注釈を必須化する'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isTargetValidatorCall(node)) {
          return
        }

        const [targetArg, fnArg] = node.arguments
        if (!targetArg || targetArg.type !== 'Literal' || typeof targetArg.value !== 'string') {
          return
        }
        if (!TARGET_VALUES.has(targetArg.value)) {
          return
        }
        if (!fnArg) {
          return
        }
        // named function への参照は対象外
        if (fnArg.type === 'Identifier') {
          return
        }
        if (fnArg.type !== 'ArrowFunctionExpression' && fnArg.type !== 'FunctionExpression') {
          return
        }
        if (fnArg.returnType) {
          return
        }

        context.report({
          node: fnArg,
          message: MESSAGE
        })
      }
    }
  }
}
