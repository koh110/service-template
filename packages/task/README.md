# task

バッチ/ジョブを実行するための CLI パッケージ。1プロセス1コマンドで起動し、実行トリガーは外部(cron・イベント・手動実行)を想定する。各タスクは `src/index.ts` の switch 内で動的 import されるため、あるタスクの実行が他タスク用の env を要求することはない。

## タスク一覧

| コマンド | 説明 |
|---|---|
| `migrate` | `shared` の Prisma migration を本番向けに適用する(`prisma migrate deploy`) |
| `hello [name]` | DI パターンのデモ。DB のユーザー数を含めた挨拶メッセージを返す |

## ローカル実行

```bash
npm run dev-migrate -w task
npm run dev-hello -w task -- world
```

## 本番での起動例

```bash
docker run --rm -e DATABASE_URL=... <image> migrate
docker run --rm -e DATABASE_URL=... <image> hello world
```
