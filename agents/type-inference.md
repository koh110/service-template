# 型推論ガイドライン

新しく TypeScript の型を手書きしようとしたとき(API レスポンスの形、ラップした UI コンポーネントの props、DB の行の形)に参照する。

新しく型を定義する前に、既存の型ソースから導出できないか以下の優先順位で確認する。

1. Server Action の戻り値型(`ExtractSuccessData<Awaited<ReturnType<typeof fn>>>`。`fn` は対象の Server Action 関数自体。呼び出し元で成功時の data 形状を再定義せず、Server Action の実装(ひいてはスキーマ)が変われば呼び出し側の型も自動で追随する)
2. 生成済みスキーマ(`shared/src/schema` の `paths`。例: `import type * as schema from 'shared/src/schema'` の上で `schema.paths['/api/user']['get']['responses']['200']['content']['application/json']`)
3. 共通コンポーネントの props 型(ラップ対象コンポーネントの `ComponentProps<typeof X>`。例: `packages/client/src/app/_components/ui/Button.tsx`)
4. Prisma の生成型(`shared/src/prisma` の `Prisma.userGetPayload<{ select: typeof selectFields }>` 等)

よくある違反:

- Server Action の呼び出し元で成功時のレスポンス形を手書きする → `ExtractSuccessData<Awaited<ReturnType<typeof fn>>>`(`shared/src/index` の `ExtractSuccessData` / `ExtractErrorData`)で導出する
- API レスポンスの型を手書きする → `schema.paths[...]` から導出する
- Radix 等をラップする共通コンポーネントで props を独自定義する → ラップ対象の `ComponentProps<typeof X>` を使う
- DB から取得したデータの型を手書きする → `Prisma.xxxGetPayload<{ select: ... }>` を使う
