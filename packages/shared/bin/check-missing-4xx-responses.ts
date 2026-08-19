#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    file: {
      type: 'string',
      default: './tsp-output/schema/openapi.yaml'
    },
    status: {
      type: 'string',
      default: '400'
    },
    methods: {
      type: 'string',
      default: 'post,put'
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false
    }
  }
})

function showHelp() {
  console.log(`Usage: check-missing-4xx-responses [options]

TypeSpec からコンパイルされた openapi.yaml を走査し、
指定した HTTP メソッドの操作のうち指定したステータスコードの
レスポンス定義が無いものを一覧表示する。

npm run compile を先に実行して openapi.yaml を最新化しておくこと
(このツール自体は再コンパイルしない)。

Options:
  --file <path>     openapi.yaml のパス (default: ./tsp-output/schema/openapi.yaml)
  --status <list>   確認するステータスコードのカンマ区切りリスト (default: 400)
  --methods <list>  確認する HTTP メソッドのカンマ区切りリスト (default: post,put)
  -h, --help        このヘルプを表示

Note: 500 系のチェックは意図的にデフォルト対象外にしている。既存 API 全体で
500 (InternalServerError) レスポンス定義に広範な欠落があり (--status=400,500 で
確認可能)、その解消は本ツール導入時のスコープ外だったため。`)
}

type Operation = {
  path: string
  method: string
  statusCodes: string[]
  hasRequestBody: boolean
  hasParameters: boolean
}

function parseOperations(yamlText: string): Operation[] {
  const lines = yamlText.split('\n')
  const operations: Operation[] = []

  let currentPath: string | null = null
  let currentMethod: string | null = null
  let currentStatusCodes: string[] = []
  let currentHasRequestBody = false
  let currentHasParameters = false

  function flush() {
    if (currentPath && currentMethod) {
      operations.push({
        path: currentPath,
        method: currentMethod,
        statusCodes: currentStatusCodes,
        hasRequestBody: currentHasRequestBody,
        hasParameters: currentHasParameters
      })
    }
    currentStatusCodes = []
    currentHasRequestBody = false
    currentHasParameters = false
  }

  for (const line of lines) {
    const pathMatch = line.match(/^ {2}(\/\S+):\s*$/)
    if (pathMatch) {
      flush()
      currentPath = pathMatch[1] ?? null
      currentMethod = null
      continue
    }

    const methodMatch = line.match(
      /^ {4}(get|post|put|delete|patch):\s*$/
    )
    if (methodMatch) {
      flush()
      currentMethod = methodMatch[1] ?? null
      continue
    }

    if (currentPath && currentMethod) {
      const statusMatch = line.trim().match(/^'(\d{3})':\s*$/)
      if (statusMatch) {
        currentStatusCodes.push(statusMatch[1] ?? '')
      }
      // requestBody: / parameters: は operation 直下 (6 spaces) のキー。
      // responses 配下のネストしたキーと誤認しないよう、インデント幅で判定する。
      if (/^ {6}requestBody:\s*$/.test(line)) {
        currentHasRequestBody = true
      }
      // `parameters: []` (空配列のインライン表記) は「parameters を持たない」
      // ものとして扱う必要があるため、ブロック形式 (末尾に値が無い) のみを検出する。
      if (/^ {6}parameters:\s*$/.test(line)) {
        currentHasParameters = true
      }
    }
  }
  flush()

  return operations
}

function main() {
  if (values.help) {
    showHelp()
    return
  }

  const filePath = path.resolve(process.cwd(), values.file ?? '')
  const yamlText = readFileSync(filePath, 'utf8')
  const operations = parseOperations(yamlText)

  const targetMethods = (values.methods ?? '')
    .split(',')
    .map((m) => {
      return m.trim().toLowerCase()
    })
    .filter((m) => {
      return m.length > 0
    })
  const targetStatuses = (values.status ?? '')
    .split(',')
    .map((s) => {
      return s.trim()
    })
    .filter((s) => {
      return s.length > 0
    })

  const targetOperations = operations.filter((op) => {
    return targetMethods.includes(op.method)
  })
  const missing = targetOperations
    .map((op) => {
      return {
        op,
        missingStatuses: targetStatuses.filter((status) => {
          // 400 (Bad Request) はリクエストの形状違反 (body / path・query 等の
          // parameters) を表す。template では `validator('param')` /
          // `validator('query')` の失敗でも 400 を返すため、requestBody を
          // 持たない operation であっても parameters (path/query/header 等) を
          // 持つ限り 400 は発生し得る。両方とも持たない operation
          // (例: 引数を取らない GET) のみを対象外とする。500 等は
          // body/parameters の有無に関わらず対象のまま。
          if (
            status === '400' &&
            !op.hasRequestBody &&
            !op.hasParameters
          ) {
            return false
          }
          return !op.statusCodes.includes(status)
        })
      }
    })
    .filter(({ missingStatuses }) => {
      return missingStatuses.length > 0
    })

  console.log(
    `Total ${targetMethods.join('/')} operations: ${targetOperations.length}`
  )
  console.log(
    `Missing ${targetStatuses.join('/')}: ${missing.length} operations`
  )
  console.log('---')
  for (const { op, missingStatuses } of missing) {
    console.log(
      `${op.method.toUpperCase()} ${op.path} -> has [${op.statusCodes.join(',')}], missing [${missingStatuses.join(',')}]`
    )
  }

  if (missing.length > 0) {
    process.exitCode = 1
  }
}

main()
