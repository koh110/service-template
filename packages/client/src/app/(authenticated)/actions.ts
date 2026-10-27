'use server'
import 'server-only'
import { cookies } from 'next/headers'
import { API_URI } from '../../config.server'
import { type APIResult, client, fetcher } from '../_lib/api'
import { SESSION_COOKIE_NAME } from '../_lib/auth/index'
import { logger } from '../_lib/logger'

type FetchUserListResponse = APIResult<typeof client<'/api/user', 'get'>, 200>

export const fetchUserList = fetcher(async (): Promise<FetchUserListResponse> => {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) {
    return {
      ok: false,
      status: 401,
      body: 'not authenticated'
    }
  }

  const url = new URL('/api/user', API_URI)
  const res = await client(url.toString(), {
    path: '/api/user',
    method: 'get',
    parameters: {
      header: {
        Authorization: `Bearer ${sessionCookie}`
      }
    }
  })
  if (res.status === 200) {
    return { ok: true, ...res }
  }
  // レスポンス body を丸ごとログへ流すと provider 由来の値まで載るため、
  // status / url のみを残す(agents/logging.md 参照)
  logger.debug({
    label: 'fetchUserList',
    body: 'unexpected status',
    meta: { status: res.status, url: url.toString() }
  })
  return { ok: false, ...res }
})
