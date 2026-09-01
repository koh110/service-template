import { NEXT_PUBLIC_ENV } from '../../constants'
import { redact, serializeError } from './redact'

/**
 * structured log の単一入口。application code から console を直接呼ばず、
 * 必ずこの logger を経由する(`no-console` lint で強制している)。
 *
 * - `meta` は `redact()` を通し、sensitive key と plain object 以外を落とす
 * - `error` は `serializeError()` で name/message/stack/cause の限定 shape にする
 * - `requestId` は api の access log と突き合わせるための共通 field(呼び出し側が明示的に渡す)
 */
type LogOptions = {
  label?: string
  requestId?: string
  body: string
  meta?: Record<string, unknown>
  error?: unknown
}

type Level = 'INFO' | 'ERROR' | 'DEBUG'

function buildLog(level: Level, options: LogOptions) {
  const { label, requestId, body, meta, error } = options
  return {
    level,
    ...(label === undefined ? {} : { label }),
    ...(requestId === undefined ? {} : { requestId }),
    body,
    ...(meta === undefined ? {} : { meta: redact(meta) }),
    ...(error === undefined ? {} : { error: serializeError(error) })
  }
}

export const logger = {
  log: (options: LogOptions) => {
    const json = buildLog('INFO', options)
    if (NEXT_PUBLIC_ENV.local) {
      console.dir(json, { depth: null })
      return
    }
    console.log(JSON.stringify(json))
  },
  error: (options: LogOptions) => {
    const json = buildLog('ERROR', options)
    if (NEXT_PUBLIC_ENV.local) {
      console.dir(json, { depth: null })
      return
    }
    console.error(JSON.stringify(json))
  },
  debug: (options: LogOptions) => {
    if (!NEXT_PUBLIC_ENV.production) {
      const json = buildLog('DEBUG', options)
      console.dir(json, { depth: null })
    }
  }
} as const
