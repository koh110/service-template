# Testing Guidelines

`*.test.ts`、およびテスト補助ファイル(`test/` 配下の setup / globalSetup 等)を新規作成・編集するときに参照する。

## import 元

- テストコードは `vitest` ではなく `vite-plus/test`(`TestProject` 等の型は `vite-plus/test/node`)から import する。`vite-plus`(vp)はテストランナーとして vitest 互換の実装を内部に持つが `vitest` パッケージ自体には依存しないため、`node_modules` に実体が存在しない。`vitest` を devDependency として個別に追加すると、vp が内部で保持するバージョンとの二重管理・ズレが生じるため行わない

## 並列実行への耐性

DB を使うテストは vitest の worker 単位で並列実行される(`VITEST_POOL_ID` で worker ごとに DB が分離される)。同一 worker 内の複数テストファイル間の干渉を防ぐため:

- seed データの識別子には vitest fixture 経由で受け取れる `task.id` を prefix として使う(テストごとに一意になるため、並列実行時の衝突を避けられる)
- `beforeAll` で複数テストが共有する seed を作らない(片方のテストが依存するデータを別テストが変更・削除すると、実行順序に依存する不安定なテストになる)
- 件数(`count` / `length`)を assertion に使わない(他のテストが作ったデータが残っていると期待値が変わる。`prefix` で絞り込んだ上で個別の値を検証する)
- `describe` を使わない(共通の `beforeEach` / `beforeAll` スコープを作る誘因になり、上記の共有 seed 問題を招きやすいため。フラットな `test()` を使う)
  - この規約は `vite.config.ts` の `lint.overrides`(`*.test.ts` に対して `no-restricted-imports` で `vite-plus/test` からの `describe` import を error にする)で機械的に強制している
- `truncateTables` は `beforeAll` 以外で呼ばない(`beforeEach` 等で呼ぶと、同一 worker 内で並行実行される他テストのデータまで消してしまう)
- globalSetup(`test/globalSetup.ts` 等)でモジュールをモックしない。複数テストファイルで共有したいモックがある場合は、モック本体ではなく mock factory 関数(`vi.mock` に渡すコールバック)を export し、各テストファイル側で個別に `vi.mock` を呼ぶ
- pagination の検証のためだけに大量データを投入しない(実行コストが増えるだけでなく、他テストとのデータ競合リスクも増える。境界値(0件/1件/上限+1件など)を少数のデータで検証する)

## 固定 unique 値を使わざるを得ない場合

一意制約のあるカラムに固定値(enum の特定の値など)を使わざるを得ず、`prefix` で一意化できない場合は、「指定した集合だけが存在する状態」へ収束させるイディオムを使う(既存データの削除 → 指定集合の作成、を毎回行うことで宣言順に依存しない):

```ts
await dbClient.xxx.deleteMany({ where: { key: { notIn: desiredKeys } } })
await dbClient.xxx.createMany({ data: desiredRows, skipDuplicates: true })
```

## seed factory 規約

DB モデル 1 つにつき `test/seeds/<table>.ts` を 1 ファイル用意し、`test/seeds/index.ts` から barrel export する。

- シグネチャは `(seed: Partial<Prisma.$<table>Payload['scalars']>, prefix: string = '') => ...` の 2 引数で統一する
- unique 制約のあるカラム・識別に使うカラムには `prefix` と `randomUUID()` を前置し、テスト間の値衝突を避ける
- 個別指定が無いフィールドは `??` でデフォルト値を補う
- 戻り値には `satisfies Omit<Prisma.$<table>Payload['scalars'], 'id'>` を付け、必須カラムの指定漏れを tsc の時点で検出する(スキーマにカラムが追加されたのに factory 側の更新を忘れる、という事故を防ぐ)

```ts
import { randomUUID } from 'node:crypto'
import { Prisma } from 'shared/src/prisma'

export function createUserSeed(
  seed: Partial<Prisma.$userPayload['scalars']>,
  prefix: string = ''
) {
  const random = randomUUID()
  const now = new Date()

  return {
    name: seed.name ? `${prefix}_${seed.name}` : `${prefix}_${random}`,
    created_at: seed.created_at ?? now,
    updated_at: seed.updated_at ?? now
  } satisfies Omit<Prisma.$userPayload['scalars'], 'id'>
}
```

呼び出し側では既存の `task.id` prefix 規約(並列実行時の衝突回避)をそのまま `prefix` 引数に渡す: `createUserSeed({ name: 'user1' }, task.id)`。

## 型テストヘルパー

型レベルのアサーションが必要になったときのために、`Assert<Cond extends true, Msg extends string = 'assertion failed'>` / `Equals<A, B>` のような型ヘルパーを用意しておくと、ランタイムの `expect` では検証しにくい「導出された型が期待どおりか」を tsc に検証させられる(必要になった時点で導入すればよく、先回りして作らない)。
