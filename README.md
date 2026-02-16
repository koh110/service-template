# service-template

## dev

```bash
# setup project
$ npm run init-local -w bin
# build shared lib
$ npm run build -w shared
# middleware (db + envoy proxy)
$ docker compose up
# api (http://localhost:8001)
$ npm run dev -w api
# client (via Envoy)
$ npm run dev -w client
```

```bash
# access local db
$ docker exec -it $(docker compose ps --format '{{.Name}}' db) bash
root@xxxx:/# psql -d dbname -U username
dbname=# 
```
