import type * as schema from 'shared/src/generated/schema'
import type { Result } from 'shared/src/index'

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type StatusNumKeys<R> = Extract<keyof R, number>
type TypedResponse<R> = {
  [S in StatusNumKeys<R>]: {
    status: S
    body: R[S] extends { content: { 'application/json': infer U } }
      ? U
      : R[S] extends { content: { 'text/plain': infer TP } }
        ? TP extends string
          ? TP
          : string
        : unknown
  }
}[StatusNumKeys<R>]

type HttpStatus = 200 | 201 | 400 | 401 | 403 | 500

export type ClientResponse<R> =
  | TypedResponse<R>
  | { status: Exclude<HttpStatus, StatusNumKeys<R>>; body: string }

type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace'

type OptionsFor<
  T extends keyof schema.paths,
  K extends HttpMethod
> = Parameters<typeof createFetchOptions<T, K>>[0]

export async function client<
  T extends keyof schema.paths,
  K extends HttpMethod
>(
  url: string,
  options: OptionsFor<T, K>,
  _init?: { next?: RequestInit['next'] } & RequestInit
): Promise<
  Prettify<
    ClientResponse<
      schema.paths[T][K] extends { responses: infer R } ? R : never
    >
  >
> {
  const _options = options
  const init: Parameters<typeof fetch>[1] = {
    ..._init,
    method: _options.method,
    headers: {
      'Content-Type': 'application/json',
      ...(_init?.headers ?? {})
    }
  }

  function hasHeader(o: typeof _options): o is typeof _options & {
    parameters: { header: Record<string, string> }
  } {
    return (
      'parameters' in o &&
      o.parameters !== null &&
      // biome-ignore lint/suspicious/noExplicitAny: fetch options
      typeof (o as any).parameters === 'object' &&
      // biome-ignore lint/suspicious/noExplicitAny: fetch options
      'header' in (o as any).parameters
    )
  }

  if (hasHeader(_options)) {
    init.headers = {
      ...init.headers,
      ..._options.parameters.header
    }
  }

  function hasRequestBody(o: typeof _options) {
    return 'requestBody' in o
  }

  if (hasRequestBody(_options)) {
    init.body = JSON.stringify(_options.requestBody)
  }

  const res = await fetch(url, init)
  let body = await res.text()
  const contentType = res.headers.get('Content-Type')
  if (
    body.length > 0 &&
    init.headers &&
    typeof contentType === 'string' &&
    contentType.includes('application/json')
  ) {
    body = JSON.parse(body)
  }

  type Res = schema.paths[T][K] extends { responses: infer R } ? R : never

  return {
    status: res.status,
    body
  } as Prettify<ClientResponse<Res>>
}

export function createFetchOptions<
  T extends keyof schema.paths,
  K extends HttpMethod
>(
  options: {
    path: T
    method: K
  } & (schema.paths[T][K] extends { parameters: infer P }
    ? { parameters: P }
    : Record<never, never>) &
    (schema.paths[T][K] extends {
      requestBody: { content: { 'application/json': infer Q } }
    }
      ? { requestBody: Q }
      : Record<never, never>)
) {
  return options
}

type APIResultBase<
  T extends keyof schema.paths,
  K extends HttpMethod,
  SuccessStatus extends number,
  APIResponse extends { status: number; body: unknown } = Awaited<
    ReturnType<typeof client<T, K>>
  >
> = Result<
  Extract<APIResponse, { status: SuccessStatus }>['body'],
  | Extract<
      APIResponse,
      { status: Exclude<APIResponse['status'], SuccessStatus>; body: unknown }
    >['body']
  | string
>

export type APIResult<
  T extends keyof schema.paths,
  K extends HttpMethod,
  SuccessStatus extends number
> = APIResultBase<T, K, SuccessStatus>
