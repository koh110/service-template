import type * as schema from 'shared/src/schema'
import { client as baseClient, type HttpMethod } from 'shared/src/api-client'

export type { APIResult } from 'shared/src/api-client'
export { extractErrorMessage } from 'shared/src/api-client'

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K
}[keyof T]

type BrowserHeader<H> = Omit<H, 'Authorization'> & {
  Authorization?: never
}

type BrowserHeaderField<P> = P extends { header: infer H }
  ? [RequiredKeys<Omit<H, 'Authorization'>>] extends [never]
    ? { header?: BrowserHeader<H> }
    : { header: BrowserHeader<H> }
  : P extends { header?: infer H }
    ? { header?: BrowserHeader<NonNullable<H>> }
    : Record<never, never>

type BrowserParameters<P> = Omit<P, 'header'> & BrowserHeaderField<P>

type BrowserParameterField<P> = [RequiredKeys<BrowserParameters<P>>] extends [never]
  ? { parameters?: BrowserParameters<P> }
  : { parameters: BrowserParameters<P> }

type BrowserOptions<
  T extends keyof schema.paths,
  K extends HttpMethod,
  BaseOptions = Parameters<typeof baseClient<T, K>>[1]
> = BaseOptions extends { parameters: infer P }
  ? Omit<BaseOptions, 'parameters'> & BrowserParameterField<P>
  : BaseOptions

export function client<T extends keyof schema.paths, K extends HttpMethod>(
  url: Parameters<typeof baseClient<T, K>>[0],
  options: BrowserOptions<T, K>,
  init?: Parameters<typeof baseClient<T, K>>[2]
) {
  // The same-origin gateway satisfies the upstream Authorization requirement
  // from the httpOnly session cookie. Browser code must not provide that header.
  return baseClient<T, K>(
    url,
    options as Parameters<typeof baseClient<T, K>>[1],
    {
      ...init,
      credentials: 'include'
    }
  )
}
