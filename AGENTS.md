# AGENTS.md

## dev

- 作業開始前に必ず実行: `[ -f .env ] || bash init.sh`
  - root の `.env` の有無が「ローカル環境が初期化済みか」の唯一の判定基準。存在しなければ `init.sh` を実行してから作業を始める
  - `init.sh` は `npm i` → `npm run init`(ブランチ名から `COMPOSE_PROJECT_NAME` を生成)→ `docker compose up -d --wait` → migration → `shared` の build まで行う
  - worktree を削除する前には `cleanup.sh` を実行すること(孤児コンテナ/ネットワークが残るのを防ぐ)。DB データは named volume に残るので、完全にリセットしたい場合は `docker compose down -v` を使う
- use npm workspaces
- lint のカスタムルール(oxlint の JS plugin)は `lint-rules/` に置き、ルート `vite.config.ts` の `lint.jsPlugins` / `lint.overrides` から読み込む(api の実装規約を機械強制する目的。詳細は `agents/api-contract.md` の「lint による機械強制」を参照)
- O(N) となる処理を避け、O(1) となるように処理を記述する
- 実装完了の条件: 変更したパッケージに対応する CI ワークフロー(`.github/workflows/ci-{api,client,shared,task}.yml`)に書かれているコマンドをローカルで実行し、build/lint/test がエラーなく通ること。CI と異なるコマンドを実行して「通った」と判断しない
- 特定の作業をするときだけ必要な詳細ガイドラインは `agents/` 配下に置き、この AGENTS.md からは「いつ読むか」を1行で指す

## Monorepo Guidelines

- 複数パッケージ(api/bin/client/shared)の実装がたまたま似ていても、それだけを理由に共通化しない(ルートに tsconfig.base.json を作って extends させる、logger/fetcher のような実装コードを shared に抽出する、など)
- 各パッケージは実行コンテキストが異なる(Node ESM バックエンド、Next.js フロントエンド、dev専用CLI 等)。今の実装が偶然似ている・フレームワーク非依存に書けているとしても、それは本質的な共通性の証明にはならない。重複を許容し、各パッケージを自己完結させる
- shared に置いてよいのは、API契約やDBスキーマのようにフレームワーク・実装に関わらず常に同一であるべきもの(生成された OpenAPI schema 型、Prisma client、Result 型など)に限る
- 共通化を提案する前に「client パッケージが全く別のフレームワークで書き直されたら、この共通化は成立するか?」と自問する

## JavaScript Guiedelines

- arrow functionを利用する場合は改行, `{}`, `return` を省略せずに記述する
- 環境変数を扱う処理はconfig.jsにまとめる
- import/requireは相対パスを利用する

## React Guidelines

- 以下のガイドラインに従う
  - https://react.dev/learn/you-might-not-need-an-effect
- useEffectを変更検知で利用することを禁じる
- useCallback, useMemoの利用を避ける
  - パフォーマンスに問題が発生した場合のみ利用を検討する
- ReactのコンポーネントはArrow Functionではなく通常のFunctionを利用する
- propsはinterfaceではなくtypeで定義する
- コンポーネント表示/非表示の制御はActivityを利用する
- React Hook Form を導入する場合(フォームを実装するとき)は以下に従う
  - 各フィールドは `register` を直接バインドする(`watch` + `setValue` による手動ハンドリングを禁じる)
  - 初期値は `useState` 等で持たず `defaultValue` を使う
  - checkbox の配列は `string[]` として扱う
  - フォーム全体のリセットは `reset()` の手動呼び出しではなく、`key` を更新してコンポーネントごと再マウントする方式を優先する

## TypeScript Guidelines

- Node.jsで実行する場合は `ts-node` などのライブラリを利用を禁止し `strip-types` を利用する
- 最新のバージョンに従った書き方をする
- anyの利用を禁止する
- 推論できる型は推論を優先して採用し、再定義を禁じる
- interfaceよりtypeを優先して利用する
- type assertion を避ける
- interfaceは利用せずtypeを利用する
- 可能な場合は必ず `as const` を記述する
- 新しく型を手書きする前に `agents/type-inference.md` を読む(生成スキーマ・`ComponentProps`・Prisma payload から導出できないか確認する)

## Testing Guidelines

- `*.test.ts` やテスト補助ファイル(`test/` 配下の setup 等)を新規作成・編集するときは `agents/testing-guidelines.md` を読む(vitest ではなく vite-plus/test から import する理由、並列実行時の seed 設計、`describe` 禁止)

## Prisma Guidelines

- `packages/shared/prisma/schema.prisma` を編集するとき、または DB アクセスを行う関数を追加/変更するときは `agents/prisma-guidelines.md` を読む(`onDelete` の使い分け、enum 化の基準、`tx` 引数パターン)

## API Contract Guidelines

- api の handler / validator を書くときは `agents/api-contract.md` を読む(ルーティング型安全化の3点セット、バリデーション失敗時は `throw createHttpException` に統一する理由、400 レスポンス変更は公開契約変更であること)

## Validation Guidelines

- zod は api(`zod`)と client(`zod/mini`)で使い分ける。api はサーバサイドでバンドルサイズを気にする必要が薄いためフル機能の `zod` を、client はクライアントバンドルに含まれるため軽量な `zod/mini` を使う

## API 通信パターン

- GET は Server Actions(`'use server'`。`shared/src/index` の `Result` 型を返す)、POST/PUT/DELETE は `/proxy/api/...`(`packages/client/src/app/proxy/api/[...path]/route.ts`)経由のクライアントサイド関数(`packages/client/src/app/_lib/api.client.ts` の `client()`)を使う。`useActionState` / `<form action={...}>` は使わない(状態遷移やエラー表示をクライアント側で細かく制御するため)
- エラー表示は `packages/client/src/app/_lib/api.ts` の `extractErrorMessage(body)` を単一入口とする。`body.detail` 等のレスポンス形状をコンポーネント側で直接参照しない(RFC9457 の `detail` フィールド名変更やエラー形状の拡張に強くするため)

### client

- lint
  - npm run lint -w client
- typecheck
  - npm run tsc -w client
  - 型のチェックはbuildよりtypecheckを優先
- build
  1. npm run build -w shared
  2. npm run build -w client
- 各ページにのみ関連するコンポーネントはページ直下の_componentsディレクトリに配置する
- 共通で利用されるコンポーネントはsrc/app/_components以下に配置する

### api

- lint
  - npm run lint -w api
- build
  1. npm run build -w shared
  2. npm run build -w api
- bodyはvalidatorとzodで必ずバリデーションを行う
- ループ処理の内部でINSERT/UPDATE/DELETEを繰り返し実行することを禁じる
  - bulk insert/update/deleteを優先して利用する
- HTTP に依存しないドメインロジック(バリデーション、DB アクセスを伴う処理など)は `src/features/<domain>/` 以下に動詞単位のファイル(`validate.ts` / `save.ts` 等)として切り出し、テストは隣接させる(`validate.test.ts` 等)。handler(`handlers/**`)はリクエスト/レスポンスの変換と `features/` の呼び出しに徹し、薄く保つ

### shared

- lint
  - npm run lint -w shared
- build
  - npm run build -w shared
- migration local
  - npm run db-migrate -w shared

### task

- lint
  - npm run lint -w task
- build
  1. npm run build -w shared
  2. npm run build -w task
- タスクを追加する場合は `src/tasks/` に実装を置き、`src/index.ts` の switch から `await import()` で遅延読み込みする(あるタスクの実行に他タスク用の env を要求しないようにするため)
- 1タスク = 1ディレクトリとし、内部を役割ごとに分解する: `index`(全体を統合するエントリポイント)/ `db`(永続化処理)/ `lib`(純粋関数)/ 通知処理(Slack 通知等、あれば)。タスク別の config が必要な場合は、共通 config を直接 import せず、private な部品ローダーを合成する `loadXxxConfig()` パターンで組み立てる(そのタスクの実行に無関係な env 変数を要求しないため)
