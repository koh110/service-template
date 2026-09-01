# Logging Guidelines

ログ出力を伴うコード(`logger.*` の呼び出し、logger / redact 実装の変更、access log や error handler の変更)を書くときに参照する。

目的は、ログを observability の共通基盤にしつつ credential / PII / request payload が accidental に流出しないようにすること。

## 単一入口

- application code は `console.*` を直接呼ばず、パッケージごとの logger を経由する
  - api: `packages/api/src/lib/logger.ts`
  - client: `packages/client/src/app/_lib/logger.ts`
  - task: `packages/task/src/lib/logger.ts`
- `console` を直接呼んでよいのは上記 logger 実装本体と、その出力を spy/assert するテストだけ。`vite.config.ts` の `no-console` override で機械的に強制している
- dev 専用 CLI(`packages/bin`)は structured log の対象外(人間が読むための出力なので `console` を使う)

## 共通フィールド

`logger.log / error / debug` はいずれも同じ shape を受け取る。

| field | 用途 |
| --- | --- |
| `level` | logger が付与する(`INFO` / `ERROR` / `DEBUG`) |
| `label` | ログの発生箇所を識別する短い名前(`access` / `handleError` 等) |
| `requestId` | access log と application log を突き合わせるための ID |
| `body` | 人間が読むメッセージ(文字列のみ) |
| `meta` | 構造化された付加情報。`redact()` を通る |
| `error` | 例外。`serializeError()` で限定 shape になる |

### requestId

- api では `accessLogMiddleware` が `randomUUID()` で発行し、hono の `c.set('requestId', ...)` に載せる
- application log 側は `c.get('requestId')` を `logger.*` の `requestId` に渡す。これで 1 リクエストの access log と application log が同じ ID で追える
- client / task は横断して追跡したい単位(api から受け取った ID、1 実行の ID 等)を呼び出し側が明示的に渡す

## redaction

`redact()`(`redact.ts`)は 2 つの防御を併用する。key 名だけに頼ると `Headers` や provider response のような「丸ごとのオブジェクト」から漏れるため。

1. **key 名による redaction** — 小文字化 + 区切り文字除去で正規化した key 名が `authorization` / `cookie`(`set-cookie` を含む) / `password` / `secret` / `token`(`idToken` / `accessToken` / `refreshToken` / `sessionToken` を含む) / `credential` / `apikey` / `privatekey` / `sessionid` に部分一致したら値を `[REDACTED]` にする
2. **型による入力制限** — `LogValue` / `LogMeta` は JSON-safe なプリミティブ、配列、object のみを許可する。`Headers` / `Request` / `Response` / provider response などは呼び出し側で必要な field だけを明示的に抽出する

加えて、循環参照は `[CIRCULAR]`、深すぎるネストは `[DEPTH_LIMIT]`、長すぎる配列は末尾を件数へ畳み、ログ量を有界にする。

redaction は最後の防波堤であって、設計上の免罪符ではない。**request / response / headers / body を丸ごと `meta` へ渡さず、必要な field だけを抜き出して渡す**。型検査に失敗する値を assertion で無理に logger へ渡してはならない。

```ts
// NG: 何が載るか呼び出し側で分からない
logger.log({ body: 'req', meta: { headers: c.req.raw.headers, payload: await c.req.json() } })

// OK: 必要な field だけを明示する
logger.log({ label: 'access', requestId, body: `${c.req.method} ${c.req.path}`, meta: { status: c.res.status } })
```

## error の serialize

- `Error` を `{ ...error }` で spread しない。external SDK の error は request / credential を enumerable property に詰めてくることがある
- `logger.*` の `error` に渡された値は `serializeError()` が `name` / `message` / `stack` / `cause` だけの shape へ変換する。任意の property は読まない
- `Error` ではない値(文字列、`{ code, message }` 形式の SDK error 等)も `name` / `message` へ narrowing する
- `cause` チェーンは有界の深さまで辿る(循環していても停止する)
- stack trace は行数上限で切り詰める

## 静的検査

`coding-style/no-sensitive-logging`(`lint-rules/rules/no-sensitive-logging.ts`)が `logger.log / error / debug` の第 1 引数を検査し、以下を error にする。

- sensitive な key 名を持つ property(`{ authorization: ... }` / `{ 'set-cookie': ... }` 等)
- sensitive な名前の変数・プロパティ参照(`{ sessionToken }` / `{ value: provider.accessToken }` 等)
- request / response を丸ごと渡す property(`c.req.raw.headers` / `req.body` / `await c.req.json()` / `headers()` / `cookies()` 等)
- 第 1 引数オブジェクト内での spread(何が載るか静的に追えないため)

テストファイル(`*.test.ts` / `test/` 配下)は対象外。redaction が効いていることを検証するために、意図的な leakage fixture を logger へ渡す必要があるため。

## パッケージごとの重複について

`logger.ts` / `redact.ts` は api / client / task がそれぞれ自己完結して持ち、`shared` へは切り出さない。実行コンテキスト(Node ESM バックエンド / Next.js フロントエンド / CLI)が異なり、今の実装が似ているのは偶然であるため(AGENTS.md の Monorepo Guidelines)。片方だけ出力先や level policy を変えたくなったときに、共通化が足枷になる。
