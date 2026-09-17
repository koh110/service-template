import type * as schema from 'shared/src/schema'
import {
  client as baseClient,
  type HttpMethod
} from 'shared/src/api-client'

export type { APIResult } from 'shared/src/api-client'
export { extractErrorMessage } from 'shared/src/api-client'

export function client<T extends keyof schema.paths, K extends HttpMethod>(
  url: Parameters<typeof baseClient<T, K>>[0],
  options: Parameters<typeof baseClient<T, K>>[1],
  init?: Parameters<typeof baseClient<T, K>>[2]
) {
  return baseClient<T, K>(url, options, {
    ...init,
    credentials: 'include'
  })
}
