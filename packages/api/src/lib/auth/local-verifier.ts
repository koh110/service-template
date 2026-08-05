import { ENV } from '../../config.js'
import type { TokenClaims, TokenVerifier } from './token-verifier.js'

function assertNotProduction() {
  if (ENV.production) {
    throw new Error(
      'localTokenVerifier is not usable in production. Replace tokenVerifier in lib/middleware.ts with a real implementation before deploying.'
    )
  }
}

// client 側の localAuthProvider が発行する自己完結トークン(署名なし)を
// 検証するスタブ。production では使えない(assertNotProduction が throw する)。
// 実プロバイダ(Firebase Admin 等)に差し替える場合は verify() を置き換える。
export const localTokenVerifier: TokenVerifier = {
  async verify(token) {
    assertNotProduction()
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
