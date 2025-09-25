# AGENTS.md

## dev

- use npm workspaces
- at first, run `npm install` & `npm run init-local -w bin` at the root directory

### client

- lint
  - npm run lint -w client
- typecheck
  - npm run tsc -w client
  - 型のチェックはbuildよりtypecheckを優先
- build
  1. npm run build -w shared
  2. npm run build -w client

### api

- lint
  - npm run lint -w api
- build
  1. npm run build -w shared
  2. npm run build -w api

### shared

- migration local
  - npm run db-migrate -w shared