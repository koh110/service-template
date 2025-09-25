'use server'
import 'server-only'
import { Result } from 'shared/src/index'
import { API_URI } from '../config.server'
import { client } from './_lib/api'
import { logger } from './_lib/logger'

export async function fetchUserList(): Promise<
  Result<Awaited<ReturnType<typeof client<'/api/user', 'get'>>>['body']>
> {
  try {
    const res = await client(`${API_URI}/api/user`, {
      path: '/api/user',
      method: 'get',
      parameters: {
        header: {
          // @todo token
          Authorization: `Bearer ${'token'}`
        }
      }
    })
    return { ok: true, ...res }
  } catch (e) {
    logger.error({ label: 'fetchUserList', body: 'error', error: e })
    return { ok: false, status: 500, body: 'fetch error' }
  }
}
