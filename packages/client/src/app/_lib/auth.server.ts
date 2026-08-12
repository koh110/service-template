import 'server-only'
import { cookies } from 'next/headers'
import { authProvider, SESSION_COOKIE_NAME } from './auth/index'
import type { SessionClaims } from './auth/index'

export type LoginState =
  | { ok: true; claims: SessionClaims }
  | { ok: false }

export async function isLogin(): Promise<LoginState> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) {
    return { ok: false }
  }
  try {
    const claims = await authProvider.verifySessionCookie(sessionCookie)
    return { ok: true, claims }
  } catch {
    return { ok: false }
  }
}
