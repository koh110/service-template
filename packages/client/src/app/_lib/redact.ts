/**
 * ログ出力する値から credential / PII を落とすための redaction ヘルパー。
 * logger の単一入口(`_lib/logger.ts`)から呼ばれる想定で、直接 console へ
 * 書き出す実装は持たない。
 *
 * 設計方針(agents/logging.md 参照):
 * - `LogValue` / `LogMeta` 型で JSON-safe な値だけを受け付ける。
 *   Headers / Request / provider response などは呼び出し側で必要な field だけを抽出する
 * - Error は enumerable property を spread せず、name/message/stack/cause の
 *   限定 shape へ変換する
 *
 * 各パッケージは実行コンテキストが異なるため(AGENTS.md の Monorepo Guidelines)、
 * このファイルは shared へ切り出さず api/client/task がそれぞれ自己完結して持つ。
 */

/** 値が sensitive な key に紐づいていたことを示すプレースホルダ。 */
export const REDACTED = '[REDACTED]'
/** 循環参照を検出した位置。 */
export const CIRCULAR = '[CIRCULAR]'
/** ネストが深すぎて打ち切った位置。 */
export const DEPTH_LIMIT = '[DEPTH_LIMIT]'

/** ネストの最大深さ。これを超えた位置は DEPTH_LIMIT に置き換える。 */
const MAX_DEPTH = 6
/** 配列の最大要素数。超過分は件数だけを残す。 */
const MAX_ARRAY_LENGTH = 50
/** stack trace として残す最大行数(ログ量を有界にするため)。 */
const MAX_STACK_LINES = 20
/** cause チェーンを辿る最大段数(cause の循環でも停止させるため)。 */
const MAX_CAUSE_DEPTH = 3

/**
 * 正規化(小文字化 + 区切り文字除去)した key 名に対する部分一致で判定する。
 * `token` が idToken / accessToken / refreshToken / sessionToken を、
 * `cookie` が set-cookie を、それぞれまとめて拾う。
 * 判定回数を key ごとに 1 回へ抑えるため単一の正規表現にまとめている。
 */
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|password|passwd|secret|token|credential|apikey|privatekey|sessionid/

const KEY_SEPARATOR_PATTERN = /[-_\s.]/g

/** ログの key 名が redaction 対象かどうかを返す。 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.toLowerCase().replace(KEY_SEPARATOR_PATTERN, ''))
}

/**
 * `redact()` が出力しうる値。JSON へそのまま流せる形だけを許す。
 * `redactValue` が再帰しており戻り値型を推論できないため明示する。
 */
export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue }

export type LogMeta = { [key: string]: LogValue }

/** Error を JSON へ安全に落とし込むための限定 shape。 */
export type SerializedError = {
  name: string
  message: string
  stack?: string
  cause?: SerializedError
}

function trimStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined
  }
  const lines = stack.split('\n')
  if (lines.length <= MAX_STACK_LINES) {
    return stack
  }
  return [
    ...lines.slice(0, MAX_STACK_LINES),
    `    ... ${lines.length - MAX_STACK_LINES} more lines`
  ].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * external SDK が投げる「Error ではないが name/message を持つ」オブジェクトから
 * 文字列フィールドだけを取り出す。任意の enumerable property は読まない。
 */
function serializeNonError(value: unknown): SerializedError {
  if (typeof value === 'string') {
    return { name: 'NonError', message: value }
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return { name: 'NonError', message: `${value}` }
  }
  if (!isRecord(value)) {
    return { name: 'NonError', message: `${typeof value}` }
  }
  const name =
    typeof value.name === 'string'
      ? value.name
      : typeof value.code === 'string'
        ? value.code
        : 'NonError'
  const message = typeof value.message === 'string' ? value.message : '[unknown]'
  return { name, message }
}

function serializeErrorWithDepth(error: unknown, depth: number): SerializedError {
  if (!(error instanceof Error)) {
    return serializeNonError(error)
  }
  const cause =
    error.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? serializeErrorWithDepth(error.cause, depth + 1)
      : undefined
  const stack = trimStack(error.stack)
  return {
    name: error.name,
    message: error.message,
    ...(stack === undefined ? {} : { stack }),
    ...(cause === undefined ? {} : { cause })
  }
}

/**
 * Error / external SDK error を name/message/stack/cause の限定 shape へ変換する。
 * `{ ...error }` のような spread と違い、任意の enumerable property
 * (provider が詰めた credential や request payload)を持ち出さない。
 */
export function serializeError(error: unknown): SerializedError {
  return serializeErrorWithDepth(error, 0)
}

function redactValue(value: LogValue, depth: number, seen: WeakSet<object>): LogValue {
  if (value === null || value === undefined) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (seen.has(value)) {
    return CIRCULAR
  }
  if (depth >= MAX_DEPTH) {
    return DEPTH_LIMIT
  }
  seen.add(value)
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => {
      return redactValue(item, depth + 1, seen)
    })
    seen.delete(value)
    return value.length > MAX_ARRAY_LENGTH
      ? [...items, `[${value.length - MAX_ARRAY_LENGTH} more items]`]
      : items
  }
  const result: Record<string, LogValue> = {}
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1, seen)
  }
  seen.delete(value)
  return result
}

/**
 * ログの meta に載せる値から sensitive field を落とす。
 * sensitive な key の値を `[REDACTED]` に置き換える。その他の値は
 * `LogValue` 型で表現できる JSON-safe な値だけを受け付ける。
 */
export function redact(value: LogValue): LogValue {
  return redactValue(value, 0, new WeakSet())
}
