/**
 * oxlint の JS plugin API 用の型ヘルパー。
 *
 * インストール済みの oxlint(`oxlint/plugins-dev`)は現時点(JS plugin は alpha)では
 * `RuleTester` しかモジュールとして export していない(`Rule` / `Context` / `VisitorObject`
 * などの型は同じファイル内に定義されているが export されていない)。
 * そのため、唯一 export されている `RuleTester.run(name, rule, tests)` のシグネチャから
 * `Parameters` / `ReturnType` で型を逆算して再利用する。手書きで型を再定義しないことで、
 * oxlint のバージョンが上がって内部の型定義が変わった場合にも(export が修正されない限り)
 * 追従できる。
 */
import type { RuleTester } from 'oxlint/plugins-dev'

/** `RuleTester.run` の第2引数から復元した Rule 型(`create` 形式のみ)。 */
type RunRule = Parameters<RuleTester['run']>[1]
export type Rule = Extract<RunRule, { create: (context: never) => unknown }>

/** `Rule['create']` のシグネチャから復元した Context / VisitorObject 型。 */
export type Context = Parameters<Rule['create']>[0]
export type VisitorObject = ReturnType<Rule['create']>

type VisitorHandler<Name extends keyof VisitorObject> = NonNullable<VisitorObject[Name]>

export type CallExpressionNode = Parameters<VisitorHandler<'CallExpression'>>[0]
export type NewExpressionNode = Parameters<VisitorHandler<'NewExpression'>>[0]
export type MemberExpressionNode = Parameters<VisitorHandler<'MemberExpression'>>[0]
export type ObjectExpressionNode = Parameters<VisitorHandler<'ObjectExpression'>>[0]
export type PropertyNode = Parameters<VisitorHandler<'Property'>>[0]
export type IdentifierNode = Parameters<VisitorHandler<'Identifier'>>[0]
export type ImportDeclarationNode = Parameters<VisitorHandler<'ImportDeclaration'>>[0]

/**
 * `oxlint` はプラグインをファイルパス(`jsPlugins`)から動的にロードするだけで、
 * ロードしたモジュールの default export 自体の型は export していないため、
 * ここだけは(推論元が無いため)最小限の形を手書きする。
 */
export type Plugin = {
  meta: {
    name: string
  }
  rules: Record<string, Rule>
}
