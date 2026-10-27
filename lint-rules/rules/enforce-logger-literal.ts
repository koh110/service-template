/**
 * logger 呼び出しの引数を、型検査(closed event schema)が確実に効く形に
 * 固定するルール。
 *
 * 何をログへ載せてよいかは各パッケージ logger の `LogEvents` 型が決める。
 * sensitive な値そのものの検出は名前ベースの heuristic になるため lint では
 * 行わず、この lint は AST で確実に判定できる形の制約だけを強制する。
 *
 * - 第1引数は object literal に限定する(変数渡しでは TypeScript の
 *   excess property check が効かず、未知 field の混入を検出できない)
 * - `meta` の値も object literal に限定する(同上)
 * - 引数オブジェクト / meta 内での spread を禁止する(何が載るか静的に追えない)
 * - computed key を禁止する(key 名を静的に追えない)
 *
 * テストファイルは対象外。runtime の最終防衛(`redactMeta()`)を検証するために、
 * 型検査をすり抜けた値を意図的に logger へ渡す必要があるため。
 */
import type { CallExpressionNode, ObjectExpressionNode, Rule } from '../types.ts'

const LOGGER_OBJECT = 'logger'
const LOGGER_METHODS = new Set(['log', 'error', 'debug'])

/** 他のルールと同じ判定式。テストファイル・テスト補助ファイルを対象外にする。 */
const TEST_FILE = /(\.test\.(ts|tsx)$|(^|\/)test\/)/

const ARGUMENT_LITERAL_MESSAGE =
  'logger の第1引数は object literal で渡してください。変数渡しでは closed event schema の excess property check が効きません(agents/logging.md 参照)'
const META_LITERAL_MESSAGE =
  'meta は object literal で渡してください。変数渡しでは closed event schema の excess property check が効きません(agents/logging.md 参照)'
const SPREAD_MESSAGE =
  'logger へ渡すオブジェクトを spread しないでください。何がログに載るか静的に追えなくなります(agents/logging.md 参照)'
const COMPUTED_KEY_MESSAGE =
  'logger へ渡すオブジェクトで computed key を使わないでください。key 名を静的に追えなくなります(agents/logging.md 参照)'

function isLoggerCall(node: CallExpressionNode): boolean {
  const callee = node.callee
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === LOGGER_OBJECT &&
    callee.property.type === 'Identifier' &&
    LOGGER_METHODS.has(callee.property.name)
  )
}

type KeyNode = ObjectExpressionNode['properties'][number]

function getStaticKeyName(property: KeyNode): string | null {
  if (property.type !== 'Property' || property.computed) {
    return null
  }
  if (property.key.type === 'Identifier') {
    return property.key.name
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value
  }
  return null
}

export const enforceLoggerLiteralRule: Rule = {
  meta: {
    docs: {
      description:
        'logger の引数を、closed event schema の型検査が効く object literal に限定する'
    }
  },
  create(context) {
    if (TEST_FILE.test(context.filename)) {
      return {}
    }
    function checkStaticShape(node: ObjectExpressionNode): void {
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          context.report({ node: property, message: SPREAD_MESSAGE })
          continue
        }
        if (property.type === 'Property' && property.computed) {
          context.report({ node: property, message: COMPUTED_KEY_MESSAGE })
        }
      }
    }

    return {
      CallExpression(node) {
        if (!isLoggerCall(node)) {
          return
        }
        const [argument] = node.arguments
        if (!argument) {
          return
        }
        if (argument.type !== 'ObjectExpression') {
          context.report({ node: argument, message: ARGUMENT_LITERAL_MESSAGE })
          return
        }
        checkStaticShape(argument)
        for (const property of argument.properties) {
          if (property.type !== 'Property' || getStaticKeyName(property) !== 'meta') {
            continue
          }
          const meta = property.value
          if (meta.type !== 'ObjectExpression') {
            context.report({ node: property, message: META_LITERAL_MESSAGE })
            continue
          }
          checkStaticShape(meta)
        }
      }
    }
  }
}
