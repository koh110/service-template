'use server'
import 'server-only'
import { API_URI } from '../config.server'
import { type APIResult, client } from './_lib/api'
import { logger } from './_lib/logger'

type FetchUserListResponse = APIResult<'/api/user', 'get', 200>

export async function fetchUserList() {
  try {
    const url = new URL('/api/user', API_URI)
    const res = await client(url.toString(), {
      path: '/api/user',
      method: 'get',
      parameters: {
        header: {
          // @todo token
          Authorization: `Bearer ${'token'}`
        }
      }
    })
    if (res.status === 200) {
      return { ok: true, ...res } as const satisfies FetchUserListResponse
    }
    logger.debug({
      label: 'fetchUserList',
      body: 'unexpected status',
      meta: { status: res.status, body: res.body, url: url.toString() }
    })
    return { ok: false, ...res } as const satisfies FetchUserListResponse
  } catch (e) {
    logger.error({ label: 'fetchUserList', body: 'error', error: e })
    return {
      ok: false,
      status: 500,
      body: 'fetch error'
    } as const satisfies FetchUserListResponse
  }
}
