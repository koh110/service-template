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
import { noFindFirstRule } from './rules/no-find-first.ts'
import { requireReturnResponseRule } from './rules/require-return-response.ts'
import { noArrowComponentRule } from './rules/no-arrow-component.ts'

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

tester.run('no-find-first', noFindFirstRule, {
  valid: [
    // 準拠: 一意制約を使った findUnique
    { code: 'tx.user.findUnique({ where: { id } })', filename: 'packages/api/src/features/user/db.ts' },
    // 対象外: 並び順で 1 件を選ぶことが要件(orderBy あり)
    {
      code: "tx.user.findFirst({ where: { name }, orderBy: { created_at: 'desc' } })",
      filename: 'packages/api/src/features/user/db.ts'
    }
  ],
  invalid: [
    {
      code: 'tx.user.findFirst({ where: { name } })',
      filename: 'packages/api/src/features/user/db.ts',
      errors: 1
    },
    // 変数渡しは orderBy の有無を判定できないため違反
    {
      code: 'tx.user.findFirst(args)',
      filename: 'packages/api/src/features/user/db.ts',
      errors: 1
    }
  ]
})

tester.run('require-return-response', requireReturnResponseRule, {
  valid: [
    // 準拠: return している
    {
      code: 'function GET() { return Response.json({ ok: true }) }',
      filename: 'packages/client/src/app/api/route.ts'
    },
    // 対象外: 変数に入れるケース(既知の限界)
    {
      code: 'function GET() { const res = NextResponse.json({}); return res }',
      filename: 'packages/client/src/app/api/route.ts'
    },
    // 対象外: Response 以外のレシーバ
    { code: 'function f() { body.json() }', filename: 'packages/client/src/app/api/route.ts' }
  ],
  invalid: [
    {
      code: "function GET() { if (!token) { Response.json({ detail: 'x' }, { status: 401 }) } return Response.json({}) }",
      filename: 'packages/client/src/app/api/route.ts',
      errors: 1
    },
    {
      code: 'function GET() { NextResponse.json({}) }',
      filename: 'packages/client/src/app/api/route.ts',
      errors: 1
    }
  ]
})

tester.run('no-arrow-component', noArrowComponentRule, {
  valid: [
    // 準拠: function 宣言
    {
      code: 'export function Button(props: Props) { return <button>{props.label}</button> }',
      filename: 'packages/client/src/app/_components/button.tsx'
    },
    // 対象外: camelCase の Arrow Function(コンポーネントではない)
    {
      code: 'const handleClick = () => { return 1 }',
      filename: 'packages/client/src/app/_components/button.tsx'
    },
    // 対象外: .ts ファイル
    { code: 'const Schema = () => { return 1 }', filename: 'packages/client/src/app/_lib/schema.ts' }
  ],
  invalid: [
    {
      code: 'const Button = (props: Props) => { return <button /> }',
      filename: 'packages/client/src/app/_components/button.tsx',
      errors: 1
    },
    // FC 型注釈と Arrow Function 代入の両方を検出する
    {
      code: 'const Button: React.FC<Props> = (props) => { return <button /> }',
      filename: 'packages/client/src/app/_components/button.tsx',
      errors: 2
    },
    {
      code: 'const Button: FC = function () { return <button /> }',
      filename: 'packages/client/src/app/_components/button.tsx',
      errors: 1
    }
  ]
})

console.log('lint-rules: all rule tests passed')
