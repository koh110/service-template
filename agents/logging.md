# Logging Guidelines

ログ出力を伴うコード(`logger.*` の呼び出し、logger / redact 実装、access log / error handler)を書くときの原則。機械検査の詳細は `agents/lint-rules.md` を、何を meta へ載せられるかは各 logger の `LogEvents` 型を参照する。

- application code は `console.*` を直接呼ばず、パッケージごとの logger(api: `packages/api/src/lib/logger.ts`、client: `packages/client/src/app/_lib/logger.ts`、task: `packages/task/src/lib/logger.ts`)を単一入口にする。dev 専用 CLI(`packages/bin`)は人間が読む出力なので対象外
- logger の public API は closed event schema。meta を持てるのは各 logger の `LogEvents` に定義した label だけで、field は primitive のみ。新しい情報をログへ載せたいときは、値を渡す前に `LogEvents` へ label / field を追加する
- `LogEvents` に secret / credential(authorization / cookie / token 等)を表す field や、request / response / headers / body を丸ごと表す field を追加しない。必要な primitive field だけを schema に起こす
- 何を渡してよいかの判断は型に寄せる。型検査に失敗する値を assertion で無理に通さない。runtime の `redactMeta()`(sensitive key 名 → `[REDACTED]`、primitive 以外 → `[UNSUPPORTED]`)は型をすり抜けた値への最後の防波堤であって、設計上の免罪符ではない
- `error` は `serializeError()` が name / message / stack / cause の限定 shape へ変換する。`{ ...error }` のような spread は、external SDK が enumerable property に詰めた credential / request payload を持ち出すため行わない
- `requestId` で access log と application log を突き合わせる。api では `accessLogMiddleware` が発行した値を `c.get('requestId')` から渡す。client / task は追跡したい単位の ID を呼び出し側が明示的に渡す
- `logger.ts` / `redact.ts` は api / client / task がそれぞれ自己完結して持ち、shared へ切り出さない。実行コンテキストが異なるため(AGENTS.md の Monorepo Guidelines)
