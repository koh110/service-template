/**
 * React コンポーネントを Arrow Function で定義することを禁止するルール(AGENTS.md の
 * React Guidelines「コンポーネントは通常の function で定義する」)。
 *
 * 次の 2 パターンを検出する(.tsx / .jsx のみ)。
 * - `FC` / `FunctionComponent` / `React.FC` / `React.FunctionComponent` の型参照
 * - PascalCase の変数への Arrow Function の代入(`const Foo = () => { ... }`)
 *
 * 既知の限界: `memo(() => ...)` / `forwardRef((props, ref) => ...)` のように
 * 関数呼び出しの引数として渡す Arrow Function は検出しない。
 */
import type { Rule } from '../types.ts'

const JSX_FILE = /\.(tsx|jsx)$/
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/
const FC_TYPE_NAMES = new Set(['FC', 'FunctionComponent'])

const MESSAGE =
  'React コンポーネントは Arrow Function ではなく function 宣言で定義し、props は type で型付けしてください'

export const noArrowComponentRule: Rule = {
  meta: {
    docs: {
      description: 'React コンポーネントの Arrow Function 定義と FC 型を禁止する'
    }
  },
  create(context) {
    if (!JSX_FILE.test(context.filename)) {
      return {}
    }
    return {
      TSTypeReference(node) {
        const typeName = node.typeName
        const name =
          typeName.type === 'Identifier'
            ? typeName.name
            : typeName.type === 'TSQualifiedName' &&
                typeName.left.type === 'Identifier' &&
                typeName.left.name === 'React'
              ? typeName.right.name
              : undefined
        if (name === undefined || !FC_TYPE_NAMES.has(name)) {
          return
        }

        context.report({
          node,
          message: MESSAGE
        })
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== 'Identifier' ||
          !PASCAL_CASE.test(node.id.name) ||
          node.init?.type !== 'ArrowFunctionExpression'
        ) {
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
