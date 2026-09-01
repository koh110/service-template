/**
 * logger 呼び出しへ credential / request payload を渡すことを禁止するルール。
 *
 * runtime 側の `redact()` は key 名と「plain object 以外は展開しない」判定で
 * 防御するが、静的にも同じ pattern を落として実装時に気付けるようにする。
 * 検査対象は `logger.log/error/debug({ ... })` の第1引数オブジェクトのみ。
 *
 * - sensitive な key 名(`authorization` / `cookie` / `*token` 等)を持つ property
 * - sensitive な名前の変数をそのまま渡す property(`{ sessionToken }` 等)
 * - request / response を丸ごと渡す property(`c.req.raw`, `req.headers`,
 *   `res.body`, `await c.req.json()`, `headers()`, `cookies()` 等)
 * - logger 引数内での spread(何が載るか静的に追えないため)
 *
 * テストファイルは対象外。redaction が効いていることを検証するために
 * 意図的な leakage fixture(`{ authorization: 'Bearer ...' }` 等)を
 * logger へ渡す必要があるため。
 */
import type { CallExpressionNode, ObjectExpressionNode, Rule } from '../types.ts'

const LOGGER_OBJECT = 'logger'
const LOGGER_METHODS = new Set(['log', 'error', 'debug'])

/** 他のルールと同じ判定式。テストファイル・テスト補助ファイルを対象外にする。 */
const TEST_FILE = /(\.test\.(ts|tsx)$|(^|\/)test\/)/

/**
 * 正規化(小文字化 + 区切り文字除去)した名前への部分一致で判定する。
 * runtime の `redact()` が持つ SENSITIVE_KEY_PATTERN と同じ語彙を使う。
 */
const SENSITIVE_NAME_PATTERN =
  /authorization|cookie|password|passwd|secret|token|credential|apikey|privatekey|sessionid/

const NAME_SEPARATOR_PATTERN = /[-_\s.]/g

/** 丸ごと渡すと request / response の中身が載るプロパティ名。 */
const RAW_PAYLOAD_PROPERTIES = new Set(['headers', 'rawHeaders', 'cookies', 'body', 'raw'])

/** `c.req.json()` のように request payload を取り出すメソッド名。 */
const REQUEST_READER_METHODS = new Set([
  'header',
  'json',
  'text',
  'parseBody',
  'formData',
  'arrayBuffer',
  'blob'
])

/** next/headers の `headers()` / `cookies()` のような引数なしの取得関数。 */
const GLOBAL_PAYLOAD_READERS = new Set(['headers', 'cookies'])

/** ネストしたオブジェクトを辿る最大深さ(壊れた AST でも停止させるため)。 */
const MAX_DEPTH = 8

const SENSITIVE_MESSAGE =
  'secret / credential をログへ渡しています。ログに載せない、または redact 済みの値だけを渡してください(agents/logging.md 参照)'
const RAW_PAYLOAD_MESSAGE =
  'request / response の headers / body を丸ごとログへ渡しています。必要な field だけを抜き出してください(agents/logging.md 参照)'
const SPREAD_MESSAGE =
  'logger へ渡すオブジェクトを spread しないでください。何がログに載るか静的に追えなくなります(agents/logging.md 参照)'

function isSensitiveName(name: string): boolean {
  return SENSITIVE_NAME_PATTERN.test(name.toLowerCase().replace(NAME_SEPARATOR_PATTERN, ''))
}

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

type ValueNode = Extract<KeyNode, { type: 'Property' }>['value']

/** `await expr` / `expr as T` / `expr!` のようなラッパーを剥がす。 */
function unwrap(node: ValueNode): ValueNode {
  if (node.type === 'AwaitExpression') {
    return unwrap(node.argument)
  }
  if (node.type === 'TSNonNullExpression' || node.type === 'TSAsExpression') {
    return unwrap(node.expression)
  }
  return node
}

function isRawPayloadExpression(node: ValueNode): boolean {
  const target = unwrap(node)
  if (target.type === 'MemberExpression' && !target.computed) {
    return target.property.type === 'Identifier' && RAW_PAYLOAD_PROPERTIES.has(target.property.name)
  }
  if (target.type === 'CallExpression') {
    const callee = target.callee
    if (callee.type === 'Identifier' && GLOBAL_PAYLOAD_READERS.has(callee.name)) {
      return true
    }
    return (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.property.type === 'Identifier' &&
      REQUEST_READER_METHODS.has(callee.property.name)
    )
  }
  return false
}

function isSensitiveExpression(node: ValueNode): boolean {
  const target = unwrap(node)
  if (target.type === 'Identifier') {
    return isSensitiveName(target.name)
  }
  if (
    target.type === 'MemberExpression' &&
    !target.computed &&
    target.property.type === 'Identifier'
  ) {
    return isSensitiveName(target.property.name)
  }
  return false
}

export const noSensitiveLoggingRule: Rule = {
  meta: {
    docs: {
      description: 'logger へ secret / credential / request payload を渡すことを禁止する'
    }
  },
  create(context) {
    if (TEST_FILE.test(context.filename)) {
      return {}
    }
    function checkObject(node: ObjectExpressionNode, depth: number) {
      if (depth > MAX_DEPTH) {
        return
      }
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          context.report({ node: property, message: SPREAD_MESSAGE })
          continue
        }
        if (property.type !== 'Property') {
          continue
        }
        const key = getStaticKeyName(property)
        if (key !== null && isSensitiveName(key)) {
          context.report({ node: property, message: SENSITIVE_MESSAGE })
          continue
        }
        const value = unwrap(property.value)
        if (value.type === 'ObjectExpression') {
          checkObject(value, depth + 1)
          continue
        }
        if (value.type === 'ArrayExpression') {
          for (const element of value.elements) {
            if (element?.type === 'ObjectExpression') {
              checkObject(element, depth + 1)
            }
          }
          continue
        }
        if (isRawPayloadExpression(value)) {
          context.report({ node: property, message: RAW_PAYLOAD_MESSAGE })
          continue
        }
        if (isSensitiveExpression(value)) {
          context.report({ node: property, message: SENSITIVE_MESSAGE })
        }
      }
    }

    return {
      CallExpression(node) {
        if (!isLoggerCall(node)) {
          return
        }
        const [argument] = node.arguments
        if (!argument || argument.type !== 'ObjectExpression') {
          return
        }
        checkObject(argument, 0)
      }
    }
  }
}
