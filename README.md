# service-template

## dev

```bash
# one-time setup: install deps, init local env, start db/proxy (detached), run migrations, build shared
$ bash init.sh

# api (starts on a random port; reachable via the nginx proxy below)
$ npm run dev -w api
# client
$ npm run dev -w client
```

`.env` の有無が「初期化済みか」の判定基準。既に `.env` があれば `init.sh` の再実行は不要(冪等なので実行しても問題はない)。`npm run middleware` で db/proxy をフォアグラウンド起動してログを追うこともできる。

```bash
# stop local services (db data persists in a named volume)
$ bash cleanup.sh
# full reset (also wipes db data)
$ docker compose down -v
```

```bash
# access local db
$ docker exec -it $(docker compose ps --format '{{.Name}}' db) bash
root@xxxx:/# psql -d dbname -U username
dbname=# 
```
