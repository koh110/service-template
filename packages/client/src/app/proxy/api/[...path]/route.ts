import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { API_URI } from '../../../../config.server'
import { isLogin } from '../../../_lib/auth.server'
import { SESSION_COOKIE_NAME } from '../../../_lib/auth/index'

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const login = await isLogin()
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!login.ok || !sessionCookie) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const url = new URL(`/api/${path.join('/')}`, API_URI)
  url.search = request.nextUrl.search

  const hasBody = !['GET', 'HEAD'].includes(request.method)
  const res = await fetch(url, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
      // ブラウザにトークンを渡さず、サーバ側でのみ Authorization を注入する
      Authorization: `Bearer ${sessionCookie}`
    },
    body: hasBody ? await request.text() : undefined
  })

  const body = await res.text()
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json'
    }
  })
}

export { handler as DELETE, handler as GET, handler as POST, handler as PUT }
