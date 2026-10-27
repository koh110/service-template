# Lint Rules ガイドライン

パッケージ横断の機械的な規約と `lint-rules/` の追加・変更時に参照する。

## パッケージ横断の規約

`lint-rules/coding-style.ts`(プラグイン名 `coding-style`)が強制する。

- `coding-style/no-process-env-outside-config` → `process.env` の参照を config ファイル(`config.ts` / `config.server.ts` 等)に集約する(テストファイルは対象外)
- `coding-style/enforce-zod-entrypoint` → zod の entrypoint をパッケージごとに強制する(client は `zod/mini`、api は `zod`)
- `coding-style/enforce-logger-literal` → `logger.*` の第1引数と `meta` を object literal(spread / computed key なし)に限定する。何をログへ載せてよいかは logger の closed event schema(型)が決め、lint は excess property check が確実に効く形だけを保証する(テストファイルは runtime の最終防衛を検証するため対象外。詳細は `agents/logging.md`)

builtin ルールでは `no-console` を `packages/{api,client,task}/src` に対して error にし、logger 実装本体とテストだけ `vite.config.ts` の override で除外している(structured log の単一入口を保つため)。

ルールを追加・変更したら、違反例・準拠例を `lint-rules/run-tests.ts` に追加し、`npm run test-lint-rules` を通すこと(CI では `ci-lint-rules.yml` が実行する)。

## 新しい lint / 検査ルールの段階導入手順

`check-missing-4xx-responses` のような新しい機械検査を導入する際、既存コードに違反が残っている状態でいきなり CI を落とすと、無関係な PR まで巻き込んで止まってしまう。以下の順で導入する。

1. 新しいチェックを warn 相当(exit code 0 のまま結果だけ表示する、または CI 上で `continue-on-error: true` にする)で導入する
2. 既存の全違反を修正する
3. warn を外し、通常の lint/CI ステップとして error 化する(`process.exitCode = 1` を有効にする、`continue-on-error` を外す)
