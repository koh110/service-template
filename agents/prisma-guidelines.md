# Prisma Guidelines

`packages/shared/prisma/schema.prisma`(モデル・リレーション・フィールド)を編集するとき、または DB アクセスを行う関数を追加/変更するときに参照する。

- リレーションの `onDelete` は関係性に応じて明示する
  - 所有関係(親を消したら子も消えてよい): `Cascade`
  - 任意の外部キー(親が消えても子は残ってよい): `SetNull`
  - マスタ参照(参照先が使われている間は消せない): `Restrict`
- ステータス等の区分値を Boolean / Int で表現しない。将来値が増えうる区分には Prisma enum を使う
- トランザクションのネストを避けるため、DB アクセスを行う関数は `tx?: Prisma.TransactionClient` を省略可能な引数として受け取り、渡されればそれを使い、渡されなければ自前で `$transaction` を張る
