import { HTTPException } from 'hono/http-exception'
import type { schema } from 'shared/src/index'
import { z } from 'zod'
import { type createClient } from '../../../lib/database.js'

type UpdateUserApi = schema.paths['/api/user/{id}']['put']
type UpdateUserResponse = UpdateUserApi['responses']

export const updateUserBodySchema = z.object({
  name: z.optional(z.string().check(z.minLength(1), z.maxLength(100)))
})

export async function updateUser({
  dbClient,
  id,
  body
}: {
  dbClient: ReturnType<typeof createClient>
  id: number
  body: UpdateUserApi['requestBody']['content']['application/json']
}): Promise<UpdateUserResponse['200']['content']['application/json']> {
  const res = await dbClient.user.findFirst({ where: { id } })
  if (!res) {
    throw new HTTPException(404, {
      message: 'User not found'
    } satisfies UpdateUserResponse['404']['content']['application/json'])
  }

  await dbClient.user.update({
    data: {
      name: body.name
    },
    where: { id }
  })

  return {
    message: 'user updated'
  }
}
