export type Prettify<T> = { [K in keyof T]: T[K] } & {}

type Success<T> = { ok: true; status: number; body: T }
type Error<U = string> = { ok: false; status: number; body: U }
export type Result<T, U = string> = Success<T> | Error<U>

export type ExtractSuccess<R extends Result<unknown, unknown>> = Extract<
  R,
  { ok: true }
>
export type ExtractError<R extends Result<unknown, unknown>> = Extract<
  R,
  { ok: false }
>
export type ExtractSuccessData<R extends Result<unknown, unknown>> =
  ExtractSuccess<R>['body']
export type ExtractErrorData<R extends Result<unknown, unknown>> =
  ExtractError<R>['body']
