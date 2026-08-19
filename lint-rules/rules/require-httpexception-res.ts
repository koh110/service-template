/**
 * `new HTTPException(status, opts)` で opts に `cause` または `errors` プロパティを
 * 持たせているのに `res` を持たせていないケースを検出するルール。
 *
 * `res` を指定しない HTTPException は、`app.onError` 無しの経路や `cause` を見ない
 * ミドルウェアを通ると、クライアントに詳細フィールド(cause/errors)が届かない
 * (agents/api-contract.md 参照)。`createHttpException()` は常に `res` 付きで
 * HTTPException を生成するため、直接 `new HTTPException()` を書く場合はそちらの利用を促す。
 */
import type { NewExpressionNode, ObjectExpressionNode, Rule } from '../types.ts'

const MESSAGE =
  'cause/errors を含む HTTPException には res を設定してください。res が無いとクライアントに詳細フィールドが届きません。createHttpException() の利用を検討してください(agents/api-contract.md 参照)'

type ObjectPropertyOrSpread = ObjectExpressionNode['properties'][number]

function isHttpExceptionConstructor(node: NewExpressionNode): boolean {
  const { callee } = node
  return callee.type === 'Identifier' && callee.name === 'HTTPException'
}

function propertyKeyName(property: ObjectPropertyOrSpread): string | null {
  if (property.type !== 'Property') {
    return null
  }
  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value
  }
  return null
}

function hasPropertyNamed(objectExpression: ObjectExpressionNode, name: string): boolean {
  return objectExpression.properties.some((property) => {
    return propertyKeyName(property) === name
  })
}

export const requireHttpExceptionResRule: Rule = {
  meta: {
    docs: {
      description:
        'cause/errors を持つ HTTPException には res の設定を必須化する'
    }
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isHttpExceptionConstructor(node)) {
          return
        }

        const optsArg = node.arguments[1]
        if (!optsArg || optsArg.type !== 'ObjectExpression') {
          return
        }

        const hasCause = hasPropertyNamed(optsArg, 'cause')
        const hasErrors = hasPropertyNamed(optsArg, 'errors')
        if (!hasCause && !hasErrors) {
          return
        }
        if (hasPropertyNamed(optsArg, 'res')) {
          return
        }

        context.report({
          node: optsArg,
          message: MESSAGE
        })
      }
    }
  }
}
