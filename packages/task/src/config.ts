export const ENV = {
  production: process.env.APP_ENV === 'production',
  test: process.env.APP_ENV === 'test',
  local: process.env.APP_ENV === 'local'
} as const

// 各タスクに必要な env はここに関数を追加して個別に読み込む。
// index.ts の switch 内で実行するタスクのぶんだけ呼ぶことで、
// あるタスクの実行に他タスク用の env を要求しないようにする。
export function loadDatabaseConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined')
  }
  return {
    url: process.env.DATABASE_URL
  } as const
}
