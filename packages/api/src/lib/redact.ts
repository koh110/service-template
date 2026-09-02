/**
 * ログ出力を安全側に倒すための redaction ヘルパー。logger の単一入口
 * (`lib/logger.ts`)から呼ばれる想定で、直接 console へ書き出す実装は持たない。
 *
 * 第一の防御は logger の closed event schema(`logger.ts` の `LogEvents` 型)。
 * ここは型検査をすり抜けた値(assertion 等)に対する最後の防波堤:
 * - `redactMeta()` は flat な meta を走査し、sensitive な key 名の値を
 *   `[REDACTED]` へ、primitive でない値を `[UNSUPPORTED]` へ置き換える
 * - `serializeError()` は Error を name/message/stack/cause の限定 shape へ変換する
 *
 * 各パッケージは実行コンテキストが異なるため(AGENTS.md の Monorepo Guidelines)、
 * このファイルは shared へ切り出さず api/client/task がそれぞれ自己完結して持つ。
 */

/** 値が sensitive な key に紐づいていたことを示すプレースホルダ。 */
export const REDACTED = '[REDACTED]'
/** primitive でない値が meta へ渡っていたことを示すプレースホルダ。 */
export const UNSUPPORTED = '[UNSUPPORTED]'

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

/** meta の field として logger が出力する値。primitive のみを許す。 */
export type LogPrimitive = string | number | boolean | null | undefined

/**
 * ログの meta を flat に走査し、型検査をすり抜けた値を安全な形へ落とす。
 * sensitive な key 名の値は `[REDACTED]`、primitive でない値(object /
 * Headers / provider response 等)は `[UNSUPPORTED]` に置き換える。
 */
export function redactMeta(meta: Record<string, unknown>): Record<string, LogPrimitive> {
  const result: Record<string, LogPrimitive> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED
      continue
    }
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value
      continue
    }
    result[key] = UNSUPPORTED
  }
  return result
}

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
