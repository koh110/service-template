#!/bin/bash

set -euo pipefail

# worktree を削除する前に実行すること(孤児コンテナ/ネットワークが残るのを防ぐ)。
# データは named volume に残るので、完全に消したい場合は
# `docker compose down -v` を使うこと。
docker compose down
