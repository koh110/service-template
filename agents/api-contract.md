# API Contract ガイドライン

api の handler / validator を書くとき(`packages/api/src/handlers/**`)に参照する。

## ルーティング型安全化の3点セット

1. パス: `app.get('/api/user' satisfies keyof schema.paths, ...)` のように `satisfies keyof schema.paths` を付ける
2. レスポンス: `return c.json(res satisfies schema.paths[...]['responses']['200']['content']['application/json'])` のように、返す直前の値に `satisfies` を付ける
3. validator の戻り値型注釈: `validator('json', (value): UpdateUserApi['requestBody']['content']['application/json'] => {...})` のように、コールバックの戻り値型を明示する

この3点の中で最も重要なのは 3 の validator 戻り値型注釈である。1・2 はハンドラ関数の命名やファイル配置が正しければ自然に満たされるが、validator の中身(zod スキーマ)がスキーマ(TypeSpec からの生成型)とズレていても、戻り値型注釈が無ければ tsc は検出できない(zod の `safeParse` の戻り値は独自の型を持つため)。戻り値型注釈だけが「命名規則やファイル配置に依存せず、実装がスキーマと一致しているかを機械的に照合できる唯一のポイント」になる。

## バリデーション失敗時は throw する

validator コールバック内でバリデーションに失敗した場合、`c.json(...)` を `return` するのではなく `throw createHttpException<400型>(400, {...})` する。

```ts
validator('json', (value): UpdateUserApi['requestBody']['content']['application/json'] => {
  const parsed = updateUserBodySchema.safeParse(value)
  if (!parsed.success) {
    throw createHttpException<UpdateUserResponse['400']['content']['application/json']>(400, {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: parsed.error.issues.map((issue) => issue.message).join(', ')
    })
  }
  return parsed.data
})
```

Hono は `res` 付きの `HTTPException` を `app.onError` 無しでも正しく処理する(投げた時点でそのレスポンスがそのまま返る)。`app.onError(handleError)` を登録している場合でも、`handleError` は `error.res` があればそれを最優先で返すため、独自にレスポンスの形を組み立て直す必要は無い。

## 既知の罠: `cause` では拡張フィールドが届かない

`createHttpException` は必ず `res` 付きで `HTTPException` を生成する(`new HTTPException(status, { res: new Response(...) })`)。`cause` に problem オブジェクトを積む方式(`new HTTPException(status, { cause: problem })`)は、Hono 標準の `onError` 無しの経路や、`cause` を見ないミドルウェアを経由した場合にクライアントへ届かない罠があるため使わない。

- テストで検証する場合は `thrown.cause` ではなく `await thrown.getResponse().json()` で確認する
- `wrap.ts` の `handleError` に残っている `cause` フォールバック(`isProblemDetails` 判定)は、`createHttpException` を経由しない素の `HTTPException`(例: フレームワーク内部が投げるもの)のためのものであり、新規コードが `cause` に依存してよいという意味ではない

## 400 レスポンス形式の変更は公開契約の変更

400 のレスポンス形式(`BadRequestError` の shape)を変更した場合、それは公開 API 契約の変更である。`packages/client` 側で 400 の body を参照している箇所があれば、`npm run build -w shared` → `npm run build -w client` で型エラーとして検出できることを確認する。

## RFC9457 拡張メンバー

400 のエラーに `errors` のような詳細情報(フィールド単位のエラー等)を追加したい場合は、`BadRequestError & { errors?: FieldError[] }` のように optional なメンバーとして合成する(必須にすると、詳細情報が無いケースの表現ができなくなる)。

## Hono 形式パスの既知の限界

Hono のルーティングはパスパラメータを `:id` で表す(例: `/api/user/:id`)が、TypeSpec/OpenAPI 側は `{id}` で表す(`/api/user/{id}`)。この表記の違いにより、`app.put('/api/user/:id' satisfies keyof schema.paths, ...)` のように書いても `satisfies keyof schema.paths` は効かない(文字列リテラルが一致しないため)。この場合は `app.put('/api/user/:id', ...)` とし、代わりに `UpdateUserApi = schema.paths['/api/user/{id}']['put']` のように型側の参照で契約と紐付ける。

## lint による機械強制

このファイルに書かれている規約のうち、以下の3つは oxlint の JS plugin(`lint-rules/`、プラグイン名 `api-contract`)によって機械的に強制されている(`vite.config.ts` の `lint.jsPlugins` / `lint.overrides` で `packages/api/src/handlers/**` または `packages/api/src/**` に適用)。違反があると `vp lint`(`npm run lint -w api`)が error で落ちる。

- `api-contract/require-validator-return-type`: 「validator の戻り値型注釈」(上記3点セットの3)を検出する。`validator('json' | 'query' | 'param', fn)` の `fn` がアロー関数・関数式で戻り値型注釈が無い場合に検出する(`fn` が named function への参照のみの場合は検出できないため、その場合は関数宣言側で戻り値型注釈を付けること)
- `api-contract/require-httpexception-res`: 「`cause` では拡張フィールドが届かない」を検出する。`new HTTPException(status, opts)` の `opts` に `cause`/`errors` があり `res` が無い場合に検出する
- `api-contract/require-validator-for-param-query`: `<expr>.req.param(...)` / `<expr>.req.query(...)` の直接呼び出し(`validator()` を経由しない生の値の利用)を検出する

## 新しい lint / 検査ルールの段階導入手順

`check-missing-4xx-responses` のような新しい機械検査を導入する際、既存コードに違反が残っている状態でいきなり CI を落とすと、無関係な PR まで巻き込んで止まってしまう。以下の順で導入する。

1. 新しいチェックを warn 相当(exit code 0 のまま結果だけ表示する、または CI 上で `continue-on-error: true` にする)で導入する
2. 既存の全違反を修正する
3. warn を外し、通常の lint/CI ステップとして error 化する(`process.exitCode = 1` を有効にする、`continue-on-error` を外す)
