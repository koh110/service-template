/**
 * `Response.json(...)` / `NextResponse.json(...)` の return 漏れを検出するルール。
 *
 * 生成したレスポンスを式文として捨てると、関数は後続処理へ進んだうえで undefined を
 * 返すため、クライアントには意図したエラー応答が届かない(例: 401 を返したつもりの
 * 早期 return 漏れ)。
 *
 * 既知の限界: `const res = Response.json(...)` と変数に入れたまま return しないケースは
 * 検出しない(変数の使用有無の判定には scope 解析が必要なため)。
 */
import type { Rule } from '../types.ts'

const RESPONSE_OBJECTS = new Set(['Response', 'NextResponse'])

const MESSAGE =
  '生成したレスポンスが return されていません。return Response.json(...) のように返してください'

export const requireReturnResponseRule: Rule = {
  meta: {
    docs: {
      description: 'Response.json(...) / NextResponse.json(...) を式文として捨てることを禁止する'
    }
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        const expression = node.expression
        if (
          expression.type !== 'CallExpression' ||
          expression.callee.type !== 'MemberExpression' ||
          expression.callee.computed ||
          expression.callee.object.type !== 'Identifier' ||
          !RESPONSE_OBJECTS.has(expression.callee.object.name) ||
          expression.callee.property.type !== 'Identifier' ||
          expression.callee.property.name !== 'json'
        ) {
          return
        }

        context.report({
          node: expression,
          message: MESSAGE
        })
      }
    }
  }
}
