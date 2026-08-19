import type { Result } from 'shared/src/index'
import type * as schema from 'shared/src/schema'
import { logger } from './logger'

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

export type HttpMethod =
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

type ExtractQuery<Op> = Op extends {
  parameters: { query?: infer Q }
}
  ? NonNullable<Q>
  : never

type QueryType<
  T extends keyof schema.paths,
  K extends HttpMethod
> = K extends keyof schema.paths[T] ? ExtractQuery<schema.paths[T][K]> : never

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function client<
  T extends keyof schema.paths,
  K extends HttpMethod
>(
  url: string,
  options: OptionsFor<T, K> & {
    appendQuery?: (
      urlSearchParams: URLSearchParams,
      query: QueryType<T, K>
    ) => URLSearchParams
  },
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
      ..._init?.headers
    }
  }

  function hasHeader(o: typeof _options): o is typeof _options & {
    parameters: { header: Record<string, string> }
  } {
    if (!isRecord(o) || !('parameters' in o)) return false
    const { parameters } = o
    return isRecord(parameters) && 'header' in parameters
  }

  if (hasHeader(_options)) {
    init.headers = {
      ...init.headers,
      ..._options.parameters.header
    }
  }

  function hasRequestBody(o: typeof _options) {
    return isRecord(o) && 'requestBody' in o
  }

  if (hasRequestBody(_options)) {
    init.body = JSON.stringify(_options.requestBody)
  }

  function hasQuery(o: typeof _options): o is typeof _options & {
    parameters: { query: QueryType<T, K> }
  } {
    if (!isRecord(o) || !('parameters' in o)) return false
    const { parameters } = o
    return isRecord(parameters) && 'query' in parameters
  }

  let _url = url
  if (_options.appendQuery && hasQuery(_options)) {
    const urlSearchParams = new URLSearchParams()
    const sp = _options.appendQuery(
      urlSearchParams,
      _options.parameters.query
    )
    const qs = sp.toString()
    if (qs) {
      _url = `${url}${url.includes('?') ? '&' : '?'}${qs}`
    }
  }

  const res = await fetch(_url, init)
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
  ClientFn extends (...args: never[]) => unknown,
  SuccessStatus extends number,
  APIResponse extends { status: number; body: unknown } =
    Awaited<ReturnType<ClientFn>> extends { status: number; body: unknown }
      ? Awaited<ReturnType<ClientFn>>
      : never
> = Result<
  Extract<APIResponse, { status: SuccessStatus }>['body'],
  | Extract<
      APIResponse,
      { status: Exclude<APIResponse['status'], SuccessStatus>; body: unknown }
    >['body']
  | string
>

// ClientFn には `typeof client<'/api/user', 'get'>` のように、path/method で
// 具体化した client() の型をそのまま渡す。path/method を APIResult 側で
// 再指定しない(単一の情報源から導出する)ことで、client() の型と APIResult の
// 型が食い違う余地を無くす
export type APIResult<
  ClientFn extends (...args: never[]) => unknown,
  SuccessStatus extends number
> = APIResultBase<ClientFn, SuccessStatus>

// 例外を握って `{ ok: false, status: 500, body: <メッセージ> }` に落とす高階関数。
// Server Action / クライアント関数の実装から try/catch による 500 フォールバックの
// 重複を無くすために使う
export function fetcher<T, U, V extends unknown[]>(
  fn: (...args: V) => Promise<Result<T, U>>
) {
  return async (...args: V): Promise<Result<T, U | string>> => {
    try {
      return await fn(...args)
    } catch (error) {
      logger.error({ label: 'fetcher', body: 'fetch error', error })
      return {
        ok: false,
        status: 500,
        body: `${error}`
      }
    }
  }
}

// RFC9457 Problem Details (`detail`) からのエラーメッセージ抽出の単一入口。
// エラー表示は必ずこのヘルパー経由に統一し、`body.detail` 等を直接参照しない
export function extractErrorMessage(body: unknown): string {
  if (isRecord(body) && typeof body.detail === 'string') {
    return body.detail
  }
  return 'エラーが発生しました'
}
