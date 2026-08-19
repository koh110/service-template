/**
 * zod の entrypoint をパッケージごとに強制するルール。
 *
 * client はバンドルサイズのため `zod/mini` を、api はフル機能の `zod` を import する。
 * パッケージの判定はファイルパス(`packages/client/` / `packages/api/`)で行う。
 */
import type { ImportDeclarationNode, Rule } from '../types.ts'

const RESTRICTIONS = [
  {
    packagePath: '/packages/client/',
    banned: 'zod',
    message:
      "client では 'zod' ではなく 'zod/mini' を import してください(バンドルサイズのため。agents/lint-rules.md 参照)"
  },
  {
    packagePath: '/packages/api/',
    banned: 'zod/mini',
    message:
      "api では 'zod/mini' ではなく 'zod' を import してください(agents/lint-rules.md 参照)"
  }
] as const

function findViolation(filename: string, source: string): string | null {
  for (const restriction of RESTRICTIONS) {
    if (filename.includes(restriction.packagePath) && source === restriction.banned) {
      return restriction.message
    }
  }
  return null
}

export const enforceZodEntrypointRule: Rule = {
  meta: {
    docs: {
      description:
        'zod の entrypoint をパッケージごと(client は zod/mini、api は zod)に強制する'
    }
  },
  create(context) {
    return {
      ImportDeclaration(node: ImportDeclarationNode) {
        if (typeof node.source.value !== 'string') {
          return
        }

        const message = findViolation(context.filename, node.source.value)
        if (!message) {
          return
        }

        context.report({
          node,
          message
        })
      }
    }
  }
}
