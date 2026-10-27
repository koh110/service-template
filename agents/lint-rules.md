# Lint Rules ガイドライン

パッケージ横断の機械的な規約と `lint-rules/` の追加・変更時に参照する。

## パッケージ横断の規約

`lint-rules/coding-style.ts`(プラグイン名 `coding-style`)が強制する。

- `coding-style/no-process-env-outside-config` → `process.env` の参照を config ファイル(`config.ts` / `config.server.ts` 等)に集約する(テストファイルは対象外)
- `coding-style/enforce-zod-entrypoint` → zod の entrypoint をパッケージごとに強制する(client は `zod/mini`、api は `zod`)
- `coding-style/enforce-logger-literal` → `logger.*` の第1引数と `meta` を object literal(spread / computed key なし)に限定する。何をログへ載せてよいかは logger の closed event schema(型)が決め、lint は excess property check が確実に効く形だけを保証する(テストファイルは runtime の最終防衛を検証するため対象外。詳細は `agents/logging.md`)

- `coding-style/require-return-response` → `Response.json(...)` / `NextResponse.json(...)` を式文として捨てる(return 漏れ)ことを禁止する
- `coding-style/no-arrow-component` → React コンポーネントの Arrow Function 定義と `FC` / `FunctionComponent` 型を禁止する(.tsx / .jsx のみ)
- `coding-style/no-find-first` → `orderBy` を伴わない Prisma の `findFirst` を禁止する(api / task のみ。詳細は `agents/prisma-guidelines.md`)

builtin ルールでは以下を全パッケージに対して error にしている(AGENTS.md の TypeScript / JavaScript Guidelines のうち機械的に検査できるもの)。

- `typescript/no-explicit-any` → `any` を禁止する。抑制してよいのは外部ライブラリの型定義が不完全な場合だけで、disable コメントの直前に理由を書く。それ以外は `unknown` で受けて type guard で絞り込む
- `typescript/consistent-type-definitions` → `interface` ではなく `type` を使う。module augmentation(`declare module`)の宣言マージのように `interface` でしか書けない箇所だけ、理由を書いて disable する
- `typescript/consistent-type-assertions`(`assertionStyle: 'never'`)→ type assertion を禁止する(`as const` は対象外)。JSON.parse の結果に契約の型を付ける等、外部境界でどうしても必要な箇所だけ理由を書いて disable する
- `arrow-body-style`(`always`)→ arrow function の本体は `{}` と `return` を省略せずに書く

生成物(`src/generated/**`)は lint の対象外にしている。

builtin ルールでは `no-console` を `packages/{api,client,task}/src` に対して error にし、logger 実装本体とテストだけ `vite.config.ts` の override で除外している(structured log の単一入口を保つため)。

ルールを追加・変更したら、違反例・準拠例を `lint-rules/run-tests.ts` に追加し、`npm run test-lint-rules` を通すこと(CI では `ci-lint-rules.yml` が実行する)。

## 新しい lint / 検査ルールの段階導入手順

`check-missing-4xx-responses` のような新しい機械検査を導入する際、既存コードに違反が残っている状態でいきなり CI を落とすと、無関係な PR まで巻き込んで止まってしまう。以下の順で導入する。

1. 新しいチェックを warn 相当(exit code 0 のまま結果だけ表示する、または CI 上で `continue-on-error: true` にする)で導入する
2. 既存の全違反を修正する
3. warn を外し、通常の lint/CI ステップとして error 化する(`process.exitCode = 1` を有効にする、`continue-on-error` を外す)
