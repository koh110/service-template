'use server'
import 'server-only'
import { cookies } from 'next/headers'
import { API_URI } from '../../config.server'
import { type APIResult, client } from '../_lib/api'
import { SESSION_COOKIE_NAME } from '../_lib/auth/index'
import { logger } from '../_lib/logger'

type FetchUserListResponse = APIResult<'/api/user', 'get', 200>

export async function fetchUserList() {
  try {
    const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    if (!sessionCookie) {
      return {
        ok: false,
        status: 401,
        body: 'not authenticated'
      } as const satisfies FetchUserListResponse
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
