import type * as schema from 'shared/src/schema'
import { client as serverClient, type HttpMethod } from './api'

// server 側(Server Actions)は `api.ts` の client() をそのまま使い、
// GET はそちらで完結させる。POST/PUT/DELETE 等の変更系はブラウザから
// `/proxy/api/...` (同一オリジンの Next.js route handler) を直接叩く
// クライアントサイド関数として実装し、こちらの薄いラッパを使う
// (AGENTS.md の API 通信パターン参照)。
export type { APIResult } from './api'
export { extractErrorMessage, fetcher } from './api'

export function client<T extends keyof schema.paths, K extends HttpMethod>(
  url: Parameters<typeof serverClient<T, K>>[0],
  options: Parameters<typeof serverClient<T, K>>[1],
  init?: Parameters<typeof serverClient<T, K>>[2]
) {
  return serverClient<T, K>(url, options, {
    ...init,
    credentials: 'include'
  })
}
