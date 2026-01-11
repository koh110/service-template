#!/bin/bash

set -euo pipefail

# env from aws secrets
eval "$(npm run env -s -w bin -- api)"

$@
