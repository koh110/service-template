// DI パターンのデモ。dbClient は最小限の形(必要なメソッドのみ)で受け取るため、
// テストでは実 DB や PrismaClient 全体をモックする必要がない。
export type HelloDbClient = {
  user: {
    count: () => Promise<number>
  }
}

export async function hello({
  dbClient,
  name
}: {
  dbClient: HelloDbClient
  name: string
}) {
  const count = await dbClient.user.count()
  return `Hello, ${name}! There are ${count} user(s) in the database.`
}
