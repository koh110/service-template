'use server'
import 'server-only'
import { Result } from 'shared/src/index'
import { API_URI } from '../config.server'
import { client } from './_lib/api'
import { logger } from './_lib/logger'

type HealthcheckResponse = Awaited<
  ReturnType<typeof client<'/healthcheck', 'get'>>
>

export async function fetchApiStatus(): Promise<
  Result<HealthcheckResponse['body']>
> {
  try {
    const res = await client(`${API_URI}/healthcheck`, {
      method: 'get',
      path: '/healthcheck',
      parameters: {}
    })
    return { ok: true, ...res }
  } catch (e) {
    logger.error({ label: 'fetchApiStatus', body: 'error', error: e })
    return { ok: false, status: 500, body: 'fetch error' }
  }
}
