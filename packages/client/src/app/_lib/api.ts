import type { Result } from 'shared/src/index'
import { logger } from './logger'

export {
  client,
  createFetchOptions,
  extractErrorMessage
} from 'shared/src/api-client'
export type {
  APIResult,
  ClientResponse,
  HttpMethod
} from 'shared/src/api-client'

// 例外を握って `{ ok: false, status: 500, body: <メッセージ> }` に落とす高階関数。
// Server Action / クライアント関数の実装から try/catch による 500 フォールバックの
// 重複を無くすために使う
export function fetcher<T, U, V extends unknown[]>(
  fn: (...args: V) => Promise<Result<T, U>>
) {
  return async (...args: V): Promise<Result<T, U | string>> => {
    try {
      return await fn(...args)
    } catch (error) {
      logger.error({ label: 'fetcher', body: 'fetch error', error })
      return {
        ok: false,
        status: 500,
        body: `${error}`
      }
    }
  }
}
