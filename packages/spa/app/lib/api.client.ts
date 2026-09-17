import type * as schema from 'shared/src/schema'

type UserResponse =
  schema.paths['/api/user']['get']['responses']['200']['content']['application/json']

export type UserLoadResult =
  | { ok: true; body: UserResponse }
  | { ok: false; status: number; body: 'Not authenticated' | 'Forbidden' | 'Bad Gateway' }

export async function fetchUsers() {
  try {
    const response = await fetch('/api/user', {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })
    if (!response.ok) {
      const body =
        response.status === 401
          ? 'Not authenticated'
          : response.status === 403
            ? 'Forbidden'
            : 'Bad Gateway'
      return { ok: false, status: response.status, body } satisfies UserLoadResult
    }

    const body = (await response.json()) as UserResponse
    return { ok: true, body } satisfies UserLoadResult
  } catch {
    return { ok: false, status: 502, body: 'Bad Gateway' } satisfies UserLoadResult
  }
}
