export const APP_NAME = 'My App'

export const NEXT_PUBLIC_ENV = {
  production: process.env.APP_ENV === 'production',
  local: process.env.APP_ENV === 'local'
}
