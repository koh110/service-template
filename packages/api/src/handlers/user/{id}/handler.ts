import type * as schema from 'shared/src/schema'
import { z } from 'zod'
import type { createClient } from '../../../lib/database.js'
import { createHttpException } from '../../../lib/wrap.js'

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
  const res = await dbClient.user.findUnique({ where: { id } })
  if (!res) {
    throw createHttpException<
      UpdateUserResponse['404']['content']['application/json']
    >(404, {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'User not found'
    })
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
