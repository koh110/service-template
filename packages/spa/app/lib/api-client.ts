import { parseUserResponse, type UserResponse } from '../../src/api-contract'

export type UserLoadResult =
  | { ok: true; body: UserResponse }
  | { ok: false; status: number; body: 'Bad Gateway' }

export async function fetchUsers() {
  try {
    const response = await fetch('/api/user', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })
    if (!response.ok) {
      return { ok: false, status: response.status, body: 'Bad Gateway' } satisfies UserLoadResult
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
