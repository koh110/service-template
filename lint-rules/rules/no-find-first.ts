/**
 * Prisma の `findFirst` を禁止するルール(agents/prisma-guidelines.md)。
 *
 * `findFirst` は条件に一致した先頭の 1 件を黙って返すため、一意であるべき条件に
 * 一意制約が無いことに気付けない。一意な値で 1 件を特定する場合は `findUnique` を使う。
 * 並び順で 1 件を選ぶこと自体が要件の場合(例: 最新の 1 件)は、引数の object literal に
 * `orderBy` を書けば対象外になる。
 *
 * 既知の限界: 引数が変数渡しの場合は `orderBy` の有無を判定できないため違反として扱う。
 * `client['findFirst'](...)` のような computed property 経由の呼び出しは検出しない。
 */
import type { CallExpressionNode, Rule } from '../types.ts'

const MESSAGE =
  '一意なレコードの取得に findFirst を使わず、一意制約を付けて findUnique を使ってください。並び順で 1 件を選ぶことが要件なら orderBy を指定してください(agents/prisma-guidelines.md 参照)'

function isFindFirstCall(node: CallExpressionNode): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'findFirst'
  )
}

function hasOrderBy(node: CallExpressionNode): boolean {
  const [args] = node.arguments
  if (args === undefined || args.type !== 'ObjectExpression') {
    return false
  }
  return args.properties.some((property) => {
    return (
      property.type === 'Property' &&
      !property.computed &&
      property.key.type === 'Identifier' &&
      property.key.name === 'orderBy'
    )
  })
}

export const noFindFirstRule: Rule = {
  meta: {
    docs: {
      description: 'orderBy を伴わない Prisma の findFirst を禁止する'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isFindFirstCall(node) || hasOrderBy(node)) {
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
