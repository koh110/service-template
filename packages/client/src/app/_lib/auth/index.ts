import { localAuthProvider } from './local-provider'
import type { AuthProvider } from './types'

export type { AuthProvider, SessionClaims } from './types'

export const SESSION_COOKIE_NAME = 'session'

// 実プロバイダ(Firebase Admin 等)に差し替える場合はここを変更する
export const authProvider: AuthProvider = localAuthProvider
