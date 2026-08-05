import { ENV } from '../../config.js'
import type { TokenClaims, TokenVerifier } from './token-verifier.js'

function assertUsable() {
  // APP_ENV が未設定(production デプロイでの設定漏れ含む)の場合も含めて、
  // local/test 以外はすべて拒否する(fail-closed)。「production 以外なら許可」
  // という判定にすると APP_ENV 未設定時にスタブが有効なままになり、
  // 任意のトークンで認証を通過できてしまう。
  if (!ENV.local && !ENV.test) {
    throw new Error(
      'localTokenVerifier is only usable when APP_ENV is "local" or "test". Replace tokenVerifier in lib/middleware.ts with a real implementation before deploying.'
    )
  }
}

// client 側の localAuthProvider が発行する自己完結トークン(署名なし)を
// 検証するスタブ。APP_ENV が local/test 以外では使えない(assertUsable が throw する)。
// 実プロバイダ(Firebase Admin 等)に差し替える場合は verify() を置き換える。
export const localTokenVerifier: TokenVerifier = {
  async verify(token) {
    assertUsable()
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
    return { sub: claims.sub, exp: claims.exp } satisfies TokenClaims
  }
}
