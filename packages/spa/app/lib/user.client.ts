import { type APIResult, client } from './api.client'

export type UserLoadResult = APIResult<typeof client<'/api/user', 'get'>, 200>

export async function fetchUsers(): Promise<UserLoadResult> {
  try {
    const res = await client(
      '/api/user',
      {
        path: '/api/user',
        method: 'get'
      },
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      }
    )

    if (res.status === 200) {
      return { ok: true, ...res }
    }
    return { ok: false, ...res }
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: `${error}`
    }
  }
}
