import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    ignorePatterns: ['**/dist/**'],
    singleQuote: true,
    semi: false,
    trailingComma: 'none'
  },
  lint: {
    ignorePatterns: ['**/dist/**'],
    rules: {
      // 認証のローカルスタブ実装(local-provider/local-verifier)への import が
      // 存在する間は warning を出す。実プロバイダに差し替えて import が無くなれば消える。
      // 相対パスの深さやファイルの移動に影響されないよう name(完全一致)ではなく
      // patterns(glob)で判定する。
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/local-provider'],
              message:
                'ローカルスタブの認証プロバイダ(localAuthProvider)を使用しています。本番投入前に実プロバイダへ差し替えてください。'
            },
            {
              group: ['**/local-verifier', '**/local-verifier.js'],
              message:
                'ローカルスタブのトークン検証(localTokenVerifier)を使用しています。本番投入前に実プロバイダへ差し替えてください。'
            }
          ]
        }
      ]
    },
    overrides: [
      {
        files: ['**/*.test.ts'],
        rules: {
          // 並列耐性テストの規約(AGENTS.md 参照)として describe() を禁止する。
          // 一時的な reminder ではなく恒久的なコーディング規約のため error にする。
          'no-restricted-imports': [
            'error',
            {
              paths: [
                {
                  name: 'vite-plus/test',
                  importNames: ['describe'],
                  message:
                    'describe() は並列耐性テストの規約に反します(AGENTS.md 参照)。フラットな test() を使ってください。'
                }
              ]
            }
          ]
        }
      }
    ]
  }
})
