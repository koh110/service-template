# AGENTS.md

## dev

- 作業開始前に必ず実行: `[ -f .env ] || bash init.sh`
  - root の `.env` の有無が「ローカル環境が初期化済みか」の唯一の判定基準。存在しなければ `init.sh` を実行してから作業を始める
  - `init.sh` は `npm i` → `npm run init`(ブランチ名から `COMPOSE_PROJECT_NAME` を生成)→ `docker compose up -d --wait` → migration → `shared` の build まで行う
  - worktree を削除する前には `cleanup.sh` を実行すること(孤児コンテナ/ネットワークが残るのを防ぐ)。DB データは named volume に残るので、完全にリセットしたい場合は `docker compose down -v` を使う
- use npm workspaces
- O(N) となる処理を避け、O(1) となるように処理を記述する
- 実装完了の条件: 変更したパッケージに対応する CI ワークフロー(`.github/workflows/ci-{api,client,shared,task}.yml`)に書かれているコマンドをローカルで実行し、build/lint/test がエラーなく通ること。CI と異なるコマンドを実行して「通った」と判断しない

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

## TypeScript Guidelines

- Node.jsで実行する場合は `ts-node` などのライブラリを利用を禁止し `strip-types` を利用する
- 最新のバージョンに従った書き方をする
- anyの利用を禁止する
- 推論できる型は推論を優先して採用し、再定義を禁じる
- interfaceよりtypeを優先して利用する
- type assertion を避ける
- interfaceは利用せずtypeを利用する
- 可能な場合は必ず `as const` を記述する

### 型推論ガイドライン

新しく型を定義する前に、既存の型ソースから導出できないか以下の優先順位で確認する。

1. 生成済みスキーマ(`shared/src/index` の `schema`。例: `schema.paths['/api/user']['get']['responses']['200']['content']['application/json']`)
2. 共通コンポーネントの props 型(ラップ対象コンポーネントの `ComponentProps<typeof X>`。例: `packages/client/src/app/_components/ui/Button.tsx`)
3. Prisma の生成型(`Prisma.userGetPayload<{ select: typeof selectFields }>` 等)

よくある違反:

- API レスポンスの型を手書きする → `schema.paths[...]` から導出する
- Radix 等をラップする共通コンポーネントで props を独自定義する → ラップ対象の `ComponentProps<typeof X>` を使う
- DB から取得したデータの型を手書きする → `Prisma.xxxGetPayload<{ select: ... }>` を使う

## Testing Guidelines

- テストコードは `vitest` ではなく `vite-plus/test`(`TestProject` 等の型は `vite-plus/test/node`)から import する。`vite-plus`(vp)はテストランナーとして vitest 互換の実装を内部に持つが `vitest` パッケージ自体には依存しないため、`node_modules` に実体が存在しない。`vitest` を devDependency として個別に追加すると、vp が内部で保持するバージョンとの二重管理・ズレが生じるため行わない

DB を使うテストは vitest の worker 単位で並列実行される(`VITEST_POOL_ID` で worker ごとに DB が分離される)。同一 worker 内の複数テストファイル間の干渉を防ぐため:

- seed データの識別子には vitest fixture 経由で受け取れる `task.id` を prefix として使う(テストごとに一意になるため、並列実行時の衝突を避けられる)
- `beforeAll` で複数テストが共有する seed を作らない(片方のテストが依存するデータを別テストが変更・削除すると、実行順序に依存する不安定なテストになる)
- 件数(`count` / `length`)を assertion に使わない(他のテストが作ったデータが残っていると期待値が変わる。`prefix` で絞り込んだ上で個別の値を検証する)
- `describe` を使わない(共通の `beforeEach` / `beforeAll` スコープを作る誘因になり、上記の共有 seed 問題を招きやすいため。フラットな `test()` を使う)
  - この規約は `vite.config.ts` の `lint.overrides`(`*.test.ts` に対して `no-restricted-imports` で `vite-plus/test` からの `describe` import を error にする)で機械的に強制している

## Prisma Guidelines

- リレーションの `onDelete` は関係性に応じて明示する
  - 所有関係(親を消したら子も消えてよい): `Cascade`
  - 任意の外部キー(親が消えても子は残ってよい): `SetNull`
  - マスタ参照(参照先が使われている間は消せない): `Restrict`
- ステータス等の区分値を Boolean / Int で表現しない。将来値が増えうる区分には Prisma enum を使う
- トランザクションのネストを避けるため、DB アクセスを行う関数は `tx?: Prisma.TransactionClient` を省略可能な引数として受け取り、渡されればそれを使い、渡されなければ自前で `$transaction` を張る

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
