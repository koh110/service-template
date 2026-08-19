export const NEXT_PUBLIC_ENV = {
  production: process.env.APP_ENV === 'production',
  test: process.env.APP_ENV === 'test',
  local: process.env.APP_ENV === 'local'
}
