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
    // api の handler / validator 実装規約(agents/api-contract.md)を機械的に強制する
    // カスタム JS plugin。ルールの有効化(severity)は overrides 側で
    // packages/api/src 配下に限定して行う(他パッケージでは無効のまま)。
    jsPlugins: ['./lint-rules/index.ts', './lint-rules/coding-style.ts'],
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
        // パッケージ横断のコーディング規約(AGENTS.md)。config/test ファイルの除外は
        // ルール実装側(lint-rules/rules/)がファイル名で判定する。
        files: ['packages/api/src/**', 'packages/client/src/**', 'packages/task/src/**'],
        rules: {
          'coding-style/no-process-env-outside-config': 'error',
          'coding-style/enforce-zod-entrypoint': 'error',
          // structured logging の規約(agents/logging.md)。console は logger
          // 実装だけに閉じ込め、logger へ secret / request payload を渡させない。
          'coding-style/no-sensitive-logging': 'error',
          'no-console': 'error'
        }
      },
      {
        // logger 実装本体だけが console へ書き出す(structured log の単一入口)。
        files: [
          'packages/api/src/lib/logger.ts',
          'packages/client/src/app/_lib/logger.ts',
          'packages/task/src/lib/logger.ts'
        ],
        rules: {
          'no-console': 'off'
        }
      },
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
          // テストは logger の出力先である console を spy/assert するため対象外にする
          // (no-sensitive-logging 側の除外はルール実装がファイル名で判定する)。
          'no-console': 'off',
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
      },
      {
        // validator コールバックの戻り値型注釈、req.param()/req.query() 直接呼び出し禁止は
        // handler の実装規約(agents/api-contract.md)であるため handlers 配下に限定する。
        files: ['packages/api/src/handlers/**'],
        rules: {
          'api-contract/require-validator-return-type': 'error',
          'api-contract/require-validator-for-param-query': 'error'
        }
      },
      {
        // HTTPException は features/lib 等 handlers 外からも投げうるため api パッケージ全体に適用する。
        files: ['packages/api/src/**'],
        rules: {
          'api-contract/require-httpexception-res': 'error'
        }
      }
    ]
  }
})
