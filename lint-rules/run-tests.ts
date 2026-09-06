/**
 * lint-rules の全ルールを違反例・準拠例で検証するハーネス。
 * RuleTester.run は失敗時に throw するため、最後まで到達すれば全テスト成功。
 * 実行: `npm run test-lint-rules`(CI: ci-lint-rules.yml)
 */
import { RuleTester } from 'oxlint/plugins-dev'
import { requireValidatorReturnTypeRule } from './rules/require-validator-return-type.ts'
import { requireHttpExceptionResRule } from './rules/require-httpexception-res.ts'
import { requireValidatorForParamQueryRule } from './rules/require-validator-for-param-query.ts'
import { noProcessEnvOutsideConfigRule } from './rules/no-process-env-outside-config.ts'
import { enforceZodEntrypointRule } from './rules/enforce-zod-entrypoint.ts'
import { enforceLoggerLiteralRule } from './rules/enforce-logger-literal.ts'

const handlerFile = 'packages/api/src/handlers/user/index.ts'
const tester = new RuleTester()

tester.run('require-validator-return-type', requireValidatorReturnTypeRule, {
  valid: [
    // 準拠: コールバックに戻り値型注釈がある
    {
      code: "validator('json', (value): Body => { return parse(value) })",
      filename: handlerFile
    },
    // 対象外: named function への参照(宣言側で注釈を付ける運用)
    { code: "validator('json', parseBody)", filename: handlerFile },
    // 対象外: json/query/param 以外のターゲット
    {
      code: "validator('form', (value) => { return value })",
      filename: handlerFile
    }
  ],
  invalid: [
    {
      code: "validator('json', (value) => { return value })",
      filename: handlerFile,
      errors: 1
    },
    {
      code: "validator('query', function (value) { return value })",
      filename: handlerFile,
      errors: 1
    },
    { code: "validator('param', (value) => value)", filename: handlerFile, errors: 1 }
  ]
})

tester.run('require-httpexception-res', requireHttpExceptionResRule, {
  valid: [
    // 準拠: res 付きなら cause/errors を積んでもクライアントに届く
    {
      code: 'new HTTPException(400, { res: new Response(body), cause: problem })',
      filename: handlerFile
    },
    // 対象外: cause/errors を持たない素の HTTPException
    { code: "new HTTPException(500, { message: 'boom' })", filename: handlerFile }
  ],
  invalid: [
    {
      code: 'new HTTPException(400, { cause: problem })',
      filename: handlerFile,
      errors: 1
    },
    {
      code: 'new HTTPException(400, { errors: fieldErrors })',
      filename: handlerFile,
      errors: 1
    }
  ]
})

tester.run('require-validator-for-param-query', requireValidatorForParamQueryRule, {
  valid: [
    // 準拠: validator を定義し c.req.valid() 経由で取得する
    { code: "const body = c.req.valid('param')", filename: handlerFile },
    // 対象外: req 以外のレシーバ
    { code: 'url.searchParams.query(name)', filename: handlerFile }
  ],
  invalid: [
    { code: "const id = c.req.param('id')", filename: handlerFile, errors: 1 },
    { code: "const page = c.req.query('page')", filename: handlerFile, errors: 1 }
  ]
})

tester.run('no-process-env-outside-config', noProcessEnvOutsideConfigRule, {
  valid: [
    // 準拠: config ファイル内の参照は許可
    { code: 'export const PORT = process.env.PORT', filename: 'packages/api/src/config.ts' },
    {
      code: 'export const API_URI = process.env.API_URI',
      filename: 'packages/client/src/config.server.ts'
    },
    // 対象外: テストファイル
    { code: 'const db = getTestDbClient(process.env)', filename: 'packages/api/src/app.test.ts' }
  ],
  invalid: [
    {
      code: 'const dir = process.env.LOCAL_PROXY_CONFIG_DIR',
      filename: 'packages/api/src/index.ts',
      errors: 1
    },
    {
      code: "const production = process.env.APP_ENV === 'production'",
      filename: 'packages/client/src/constants.ts',
      errors: 1
    }
  ]
})

tester.run('enforce-zod-entrypoint', enforceZodEntrypointRule, {
  valid: [
    // 準拠: client は zod/mini、api は zod
    { code: "import { z } from 'zod/mini'", filename: 'packages/client/src/app/_lib/schema.ts' },
    { code: "import { z } from 'zod'", filename: 'packages/api/src/handlers/user/index.ts' },
    // 対象外: client/api 以外のパッケージ
    { code: "import { z } from 'zod'", filename: 'packages/task/src/tasks/hello/lib.ts' }
  ],
  invalid: [
    {
      code: "import { z } from 'zod'",
      filename: 'packages/client/src/app/_lib/schema.ts',
      errors: 1
    },
    {
      code: "import { z } from 'zod/mini'",
      filename: 'packages/api/src/handlers/user/index.ts',
      errors: 1
    }
  ]
})

const loggerFile = 'packages/api/src/lib/middleware.ts'

tester.run('enforce-logger-literal', enforceLoggerLiteralRule, {
  valid: [
    // 準拠: 第1引数・meta とも object literal(値の型は closed event schema が検査する)
    {
      code: "logger.log({ label: 'access', requestId, body: 'GET /api/user', meta: { method: c.req.method, path: c.req.path, status: c.res.status, duration: 12 } })",
      filename: loggerFile
    },
    // 準拠: error は logger 側の serializeError で安全な shape になる
    {
      code: "logger.error({ label: 'handleError', body: 'failed', error })",
      filename: loggerFile
    },
    // 対象外: logger 以外の呼び出し
    { code: 'client(url, { ...options })', filename: loggerFile },
    // 対象外: テストファイルは runtime の最終防衛を検証するため変数渡しを許す
    {
      code: 'logger.log(leakageFixture)',
      filename: 'packages/api/src/lib/logger/index.test.ts'
    }
  ],
  invalid: [
    // 第1引数の変数渡しは excess property check が効かない
    {
      code: 'logger.log(options)',
      filename: loggerFile,
      errors: 1
    },
    // 第1引数オブジェクトでの spread
    {
      code: "logger.log({ ...base, body: 'x' })",
      filename: loggerFile,
      errors: 1
    },
    // meta の変数渡し
    {
      code: "logger.debug({ body: 'x', meta: metaValues })",
      filename: loggerFile,
      errors: 1
    },
    // meta 内での spread
    {
      code: "logger.log({ body: 'x', meta: { ...payload } })",
      filename: loggerFile,
      errors: 1
    },
    // 第1引数オブジェクトでの computed key
    {
      code: "logger.log({ body: 'x', [key]: value })",
      filename: loggerFile,
      errors: 1
    },
    // meta 内での computed key
    {
      code: "logger.log({ body: 'x', meta: { [key]: value } })",
      filename: loggerFile,
      errors: 1
    }
  ]
})

console.log('lint-rules: all rule tests passed')
