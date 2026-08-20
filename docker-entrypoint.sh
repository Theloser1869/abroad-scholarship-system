#!/bin/sh
# Render free plan has no separate "Pre-Deploy Command" step, so there is nowhere else to
# run `prisma migrate deploy` before the app starts serving traffic. Gated behind
# RUN_MIGRATIONS_ON_BOOT (set to "true" only in render.yaml) so every other deployment
# target (docs/production/PRODUCTION_RUNBOOK.md's general guidance, local docker-compose,
# etc.) keeps its existing default behavior: migrations run as their own explicit step,
# never inside the application's own boot sequence. Only ever runs `migrate deploy` —
# additive/idempotent, safe to re-run on every restart of a single-instance service. Never
# `migrate reset`, never `db push`.
set -e

if [ "$RUN_MIGRATIONS_ON_BOOT" = "true" ]; then
  echo "RUN_MIGRATIONS_ON_BOOT=true - applying pending Prisma migrations before startup..."
  npx prisma migrate deploy --schema=database/schema.prisma
  echo "Migrations applied. Starting application..."
fi

exec node apps/api/dist/main.js
