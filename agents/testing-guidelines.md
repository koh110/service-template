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
