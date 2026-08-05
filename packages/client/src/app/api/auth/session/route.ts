import 'server-only'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { NEXT_PUBLIC_ENV } from '../../../../constants'
import { authProvider, SESSION_COOKIE_NAME } from '../../../_lib/auth/index'

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  // CSRF対策: このエンドポイントは cookie を発行するため、
  // 自オリジンからのリクエストであることを確認する
  const origin = request.headers.get('origin')
  if (origin === null || origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: 'invalid origin' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const idToken = typeof body?.idToken === 'string' ? body.idToken : null
  if (!idToken) {
    return NextResponse.json(
      { message: 'idToken is required' },
      { status: 400 }
    )
  }

  let claims: Awaited<ReturnType<typeof authProvider.verifyIdToken>>
  try {
    claims = await authProvider.verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ message: 'invalid idToken' }, { status: 401 })
  }

  const sessionCookie = await authProvider.createSessionCookie(claims, {
    expiresInMs: SESSION_MAX_AGE_MS
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: NEXT_PUBLIC_ENV.production,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS / 1000,
    path: '/'
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
