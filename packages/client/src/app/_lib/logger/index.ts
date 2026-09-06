import { NEXT_PUBLIC_ENV } from '../../../constants'
import { redactMeta, serializeError } from './redact'

/**
 * structured log の単一入口。application code から console を直接呼ばず、
 * 必ずこの logger を経由する(`no-console` lint で強制している)。
 *
 * public API は closed event schema。meta を持てるのは `LogEvents` に定義した
 * label だけで、field は primitive に限る。新しい情報をログへ載せたいときは、
 * 値を渡す前に `LogEvents` へ label / field を追加する(agents/logging.md 参照)。
 *
 * - `error` は `serializeError()` で name/message/stack/cause の限定 shape にする
 * - `requestId` は api の access log と突き合わせるための共通 field(呼び出し側が明示的に渡す)
 */

/**
 * label ごとに meta として許可する field の閉じた schema。
 * secret / credential(authorization / cookie / token 等)を表す field や、
 * request / response / headers / body を丸ごと表す field を追加してはならない。
 */
type LogEvents = {
  /** Server Actions の fetch 結果(fetchUserList) */
  fetchUserList: {
    status: number
    url: string
  }
  /** Top ページの render デバッグ */
  Top: {
    ok: boolean
  }
}

type BaseOptions = {
  requestId?: string
  body: string
  error?: unknown
}

/** `LogEvents` に定義した label は、その schema どおりの meta を渡せる。 */
type EventLogOptions = {
  [Label in keyof LogEvents]: BaseOptions & {
    label: Label
    meta: LogEvents[Label]
  }
}[keyof LogEvents]

/** それ以外の label は meta を持てない(`meta?: never`)。 */
type PlainLogOptions = BaseOptions & {
  label?: string
  meta?: never
}

type LogOptions = EventLogOptions | PlainLogOptions

type Level = 'INFO' | 'ERROR' | 'DEBUG'

function buildLog(level: Level, options: LogOptions) {
  const { label, requestId, body, meta, error } = options
  return {
    level,
    ...(label === undefined ? {} : { label }),
    ...(requestId === undefined ? {} : { requestId }),
    body,
    ...(meta === undefined ? {} : { meta: redactMeta(meta) }),
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
