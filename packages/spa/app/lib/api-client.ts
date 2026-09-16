import { parseUserResponse, type UserResponse } from '../../src/api-contract'

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

    const parsed = parseUserResponse(await response.json())
    if (parsed === null) {
      return { ok: false, status: 502, body: 'Bad Gateway' } satisfies UserLoadResult
    }
    return { ok: true, body: parsed } satisfies UserLoadResult
  } catch {
    return { ok: false, status: 502, body: 'Bad Gateway' } satisfies UserLoadResult
  }
}
