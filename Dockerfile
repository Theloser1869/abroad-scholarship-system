# Phase 14 production hardening — docs/production/PRODUCTION_RUNBOOK.md references this
# image. Multi-stage: the builder stage has the full npm workspace + devDependencies
# (needed to compile TypeScript and generate the Prisma client); the runtime stage keeps
# only production dependencies + compiled output + the Prisma schema/migrations (needed to
# run `prisma migrate deploy` as an explicit, separate step — never auto-run on container
# start, see the runbook's "migration policy").
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY database ./database
COPY apps/api ./apps/api
COPY tsconfig*.json ./

RUN npm run db:generate
RUN npm run --prefix apps/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev && npm cache clean --force

# The generated Prisma client lives inside node_modules/@prisma/client — `npm ci --omit=dev`
# above does not run `prisma generate` (prisma itself is a devDependency), so the
# already-generated client from the builder stage is copied in explicitly.
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client /app/node_modules/@prisma/client
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY database/schema.prisma ./database/schema.prisma
COPY database/migrations ./database/migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Non-root — never run the process as root inside the container.
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/storage/documents && chown -R app:app /app
USER app

EXPOSE 3000
# Reads $PORT at healthcheck-run time (not build time) — Render (and most PaaS free tiers)
# injects PORT dynamically; main.ts binds to it when set (falls back to 3000 otherwise, see
# main.ts's port-resolution comment). Render's own platform health check (configured via
# render.yaml's healthCheckPath) is what actually gates traffic on Render — this
# HEALTHCHECK instruction matters for `docker ps`/local orchestration, not Render itself.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# docker-entrypoint.sh optionally runs `prisma migrate deploy` (only when
# RUN_MIGRATIONS_ON_BOOT=true — see that file's comment and docs/DEPLOYMENT_FREE.md
# "Migration procedure"), then `exec`s straight into `node`, replacing the shell process in
# place — PID 1 still receives SIGTERM straight from `docker stop`/the orchestrator, with no
# shell left in between to swallow it, exactly as when `node` was the direct CMD. This is
# what main.ts's `enableShutdownHooks()` + SIGTERM handler actually depends on to run at all.
CMD ["./docker-entrypoint.sh"]
