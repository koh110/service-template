export type SessionClaims = {
  sub: string
  exp: number
}

export type AuthProvider = {
  // 実プロバイダ(Firebase Admin 等)では、ここで発行元の署名付き ID トークンを検証する
  verifyIdToken(idToken: string): Promise<SessionClaims>
  // 検証済み claims からセッション cookie(文字列)を発行する
  createSessionCookie(
    claims: SessionClaims,
    options: { expiresInMs: number }
  ): Promise<string>
  // セッション cookie を検証して claims を取り出す
  verifySessionCookie(sessionCookie: string): Promise<SessionClaims>
}
