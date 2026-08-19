# Prisma Guidelines

`packages/shared/prisma/schema.prisma`(モデル・リレーション・フィールド)を編集するとき、または DB アクセスを行う関数を追加/変更するときに参照する。

- リレーションの `onDelete` は関係性に応じて明示する
  - 所有関係(親を消したら子も消えてよい): `Cascade`
  - 任意の外部キー(親が消えても子は残ってよい): `SetNull`
  - マスタ参照(参照先が使われている間は消せない): `Restrict`
- ステータス等の区分値を Boolean / Int で表現しない。将来値が増えうる区分には Prisma enum を使う
- トランザクションのネストを避けるため、DB アクセスを行う関数は `tx?: Prisma.TransactionClient` を省略可能な引数として受け取り、渡されればそれを使い、渡されなければ自前で `$transaction` を張る
- `findFirst` は使わない。一意な値で1件を特定したい場合は `findUnique`(+ 対象カラムへの一意制約)を使う。「一意であるはずの条件に一意制約が無い」状態は設計不整合であり、`findFirst` で回避せずスキーマ側を見直す。`findFirst` が許されるのは「並び順(`orderBy`)で1件を選ぶこと自体が要件」の場合のみ(例: 最新の1件を取る)
- migration ファイル(`prisma/migrations/**/migration.sql`)内で seed データの INSERT を行わない。seed 投入は migration とは別の仕組み(`npm run seed`)で行う
- DB アクセスを行う関数の引数型は、実際に必要なメソッドだけを `Pick` で要求する(例: `Pick<PrismaClient, '$transaction'>`、`Pick<Prisma.TransactionClient[K], 'createMany'>`)。`PrismaClient` や `Prisma.TransactionClient` をそのまま引数型にすると、テストでの mock 実装がフル実装を要求されて肥大化する
