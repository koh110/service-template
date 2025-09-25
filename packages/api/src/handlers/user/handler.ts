import type { schema } from 'shared/src/index'
import type { createClient } from '../../lib/database.js'
import { dateToUnixTimestampSec } from '../../lib/util.js'

type ListUserResponse =
  schema.paths['/api/user']['get']['responses']['200']['content']['application/json']
export async function listUser({
  dbClient
}: {
  dbClient: ReturnType<typeof createClient>
}): Promise<ListUserResponse> {
  const res = await dbClient.user.findMany({
    select: {
      id: true,
      name: true,
      created_at: true,
      updated_at: true
    }
  })

  const user = res.map((e) => {
    return {
      id: e.id,
      name: e.name,
      created_at: dateToUnixTimestampSec(e.created_at),
      updated_at: dateToUnixTimestampSec(e.updated_at)
    } satisfies ListUserResponse['user'][number]
  })

  return {
    count: res.length,
    user
  }
}
