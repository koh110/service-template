#!/bin/bash

set -euo pipefail

npm i
npm run init
docker compose up -d --wait
npm run db-migrate -w shared
npm run build -w shared
npm run seed -w shared --if-present
