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
    }
  }
})
