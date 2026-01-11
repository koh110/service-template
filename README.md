# service-template

## dev

```bash
# setup project
$ npm run init-local -w bin
# build shared lib
$ npm run build -w shared
# middleware
$ docker compose up
# api
$ npm run dev -w api
# client
$ npm run dev -w client
```

```bash
# access local db
$ docker exec -it $(docker compose ps --format '{{.Name}}' db) bash
root@xxxx:/# psql -d dbname -U username
dbname=# 
```
