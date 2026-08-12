export type TokenClaims = {
  sub: string
  exp: number
}

export type TokenVerifier = {
  verify(token: string): Promise<TokenClaims>
}
