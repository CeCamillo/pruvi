#!/bin/sh
set -e

if [ "$PROCESS_TYPE" = "worker" ]; then
  exec bun run dist/worker.mjs
else
  exec bun run dist/index.mjs
fi
