import { NEXT_PUBLIC_ENV } from '../../../constants'
import type { AuthProvider, SessionClaims } from './types'

function assertUsable() {
  // APP_ENV が未設定(production デプロイでの設定漏れ含む)の場合も含めて、
  // local/test 以外はすべて拒否する(fail-closed)。「production 以外なら許可」
  // という判定にすると APP_ENV 未設定時にスタブが有効なままになり、
  // 任意の値でログイン・セッション偽装ができてしまう。
  if (!NEXT_PUBLIC_ENV.local && !NEXT_PUBLIC_ENV.test) {
    throw new Error(
      'localAuthProvider is only usable when APP_ENV is "local" or "test". Replace authProvider in _lib/auth/index.ts with a real implementation before deploying.'
    )
  }
}

function encodeToken(claims: SessionClaims): string {
  return Buffer.from(JSON.stringify(claims), 'utf-8').toString('base64url')
}

function decodeToken(token: string): SessionClaims {
  let claims: unknown
  try {
    claims = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
  } catch {
    throw new Error('malformed token')
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    !('sub' in claims) ||
    !('exp' in claims) ||
    typeof claims.sub !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    throw new Error('malformed token')
  }
  if (claims.exp < Date.now()) {
    throw new Error('token expired')
  }
  return { sub: claims.sub, exp: claims.exp }
}

// 署名検証を一切行わない自己完結トークンのスタブで、APP_ENV が local/test
// 以外では使えない(assertUsable が throw する)。実プロバイダ(Firebase Admin 等)に
// 差し替える場合は、この3メソッドを実際の検証・cookie発行ロジックに置き換える。
export const localAuthProvider: AuthProvider = {
  async verifyIdToken(idToken) {
    assertUsable()
    // ログインフォームに入力された文字列をそのまま識別子として扱う
    // (実プロバイダでは署名検証を行う)
    if (idToken.length === 0) {
      throw new Error('idToken is required')
    }
    return { sub: idToken, exp: Date.now() }
  },
  async createSessionCookie(claims, { expiresInMs }) {
    assertUsable()
    return encodeToken({ sub: claims.sub, exp: Date.now() + expiresInMs })
  },
  async verifySessionCookie(sessionCookie) {
    assertUsable()
    return decodeToken(sessionCookie)
  }
}
