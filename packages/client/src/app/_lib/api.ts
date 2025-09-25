import type * as schema from 'shared/src/generated/schema'

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
  options: OptionsFor<T, K>
): Promise<
  TypedResponse<schema.paths[T][K] extends { responses: infer R } ? R : never>
> {
  const _options = options
  const init: Parameters<typeof fetch>[1] = {
    method: _options.method,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  function hasHeader(o: typeof _options): o is typeof _options & {
    parameters: { header: Record<string, string> }
  } {
    return (
      'parameters' in o &&
      o.parameters !== null &&
      typeof (o as any).parameters === 'object' &&
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
  } as TypedResponse<Res>
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
