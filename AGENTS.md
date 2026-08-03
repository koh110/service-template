# AGENTS.md

## dev

- 作業開始前に必ず実行: `[ -f .env ] || bash init.sh`
  - root の `.env` の有無が「ローカル環境が初期化済みか」の唯一の判定基準。存在しなければ `init.sh` を実行してから作業を始める
  - `init.sh` は `npm i` → `npm run init`(ブランチ名から `COMPOSE_PROJECT_NAME` を生成)→ `docker compose up -d --wait` → migration → `shared` の build まで行う
  - worktree を削除する前には `cleanup.sh` を実行すること(孤児コンテナ/ネットワークが残るのを防ぐ)。DB データは named volume に残るので、完全にリセットしたい場合は `docker compose down -v` を使う
- use npm workspaces
- O(N) となる処理を避け、O(1) となるように処理を記述する
- 実装完了後にbuild/lint/testを実行し、エラーがないことを確認する

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
  - npm run lint -w api
- build
  - npm run build -w shared
- migration local
  - npm run db-migrate -w shared
