# 型推論ガイドライン

新しく TypeScript の型を手書きしようとしたとき(API レスポンスの形、ラップした UI コンポーネントの props、DB の行の形)に参照する。

新しく型を定義する前に、既存の型ソースから導出できないか以下の優先順位で確認する。

1. 生成済みスキーマ(`shared/src/index` の `schema`。例: `schema.paths['/api/user']['get']['responses']['200']['content']['application/json']`)
2. 共通コンポーネントの props 型(ラップ対象コンポーネントの `ComponentProps<typeof X>`。例: `packages/client/src/app/_components/ui/Button.tsx`)
3. Prisma の生成型(`Prisma.userGetPayload<{ select: typeof selectFields }>` 等)

よくある違反:

- API レスポンスの型を手書きする → `schema.paths[...]` から導出する
- Radix 等をラップする共通コンポーネントで props を独自定義する → ラップ対象の `ComponentProps<typeof X>` を使う
- DB から取得したデータの型を手書きする → `Prisma.xxxGetPayload<{ select: ... }>` を使う
