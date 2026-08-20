# Deployment Environment Variables

Every variable this application reads, grouped as APP / DATABASE / AUTH / STORAGE / EMAIL / JOBS / WEBHOOK, across three environments:

- **LOCAL** — your own machine, `docker compose up -d` for Postgres (+ `docker compose -f docker-compose.test.yml up -d` for MinIO if validating R2), values already in `.env`.
- **TEST** — the e2e/CI test run. Jest sets `NODE_ENV=test` automatically; `test/jest-e2e-setup.ts` loads the same `.env` LOCAL uses. No separate test env file exists or is needed.
- **REMOTE DEMO** — a real Render + Supabase + Cloudflare R2 deployment. Every value here is a placeholder — nothing in this document is a usable credential. Values marked `sync: false` in `render.yaml` are entered once in Render's dashboard, never committed.

No real secret appears anywhere in this repository. `.env` is git-ignored; `.env.example` carries only placeholders explicitly labeled as such.

---

## APP

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `test` (Jest sets this automatically, overriding `.env`) | `production` | **Mandatory** in remote — gates `assertProductionConfigSafe()` and two dev-only-token-leak safeguards (`AuthService.requestPasswordReset`, `PortalAccessService`). |
| `PORT` | unset (falls back to `API_PORT`) | unset | injected by Render — do not set a value in `render.yaml` | Render's own convention; `main.ts` reads `PORT` first, then `API_PORT`, then defaults to 3000. |
| `API_PORT` | `3000` | `3000` | unused (Render sets `PORT`) | Kept for local-dev / any non-Render target. |
| `API_REQUEST_ID_HEADER` | `x-request-id` | `x-request-id` | `x-request-id` | Rarely needs changing. |
| `API_URL` | `http://localhost:3000` | n/a | your Render service's public URL | Informational only — not consumed by any code path today; useful when writing down a deployment's own config for humans. |
| `FRONTEND_URL` | empty | n/a | your frontend's public URL, once one exists | Informational only, same as above — typically the value you also put in `CORS_ALLOWED_ORIGINS`. |
| `CORS_ALLOWED_ORIGINS` | empty (CORS closed) | empty | your real frontend origin(s), comma-separated | **Never `*`** — `assertProductionConfigSafe()` rejects a wildcard when `NODE_ENV=production`. Empty = no browser origin allowed at all (safe default before a frontend exists). |
| `RATE_LIMIT_WINDOW_MS` | `60000` | ignored (rate limiting is fully bypassed when `NODE_ENV=test`) | `60000` (tune for real traffic) | |
| `RATE_LIMIT_MAX_REQUESTS` | `120` | ignored | `120` (tune for real traffic) | |

## DATABASE (Supabase for remote)

**Connected**: Supabase project ref `xpxvvzwtvmcqkvugzfmd` (region: `ap-northeast-2`) is the REMOTE DEMO database target as of this task. Full migration history (20 migrations) has been applied and verified (64 tables, 109 foreign keys, 187 indexes, schema reported up to date by `prisma migrate status`) — see `docs/FREE_DEPLOY_CHECKLIST.md` for the verification record. No password/connection string is recorded here or anywhere else in this repository; both `DATABASE_URL`/`DIRECT_URL` live only in the local, git-ignored `.env` for now (to be moved into Render's environment-variable store, never a file, once Render is configured).

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | local Docker Postgres | same as LOCAL | Supabase **transaction-mode pooler** connection string (port `6543`, `pgbouncer=true&sslmode=require`) | The app's own runtime connection. |
| `DIRECT_URL` | same value as `DATABASE_URL` (no pooler locally) | same as LOCAL | Supabase **session-mode pooler** connection string (port `5432`, `sslmode=require`) — used as the IPv4-compatible alternative to the true Direct Connection, since this environment has no IPv6 route to Supabase's direct-connection endpoint | Prisma's migration engine needs a non-transaction-pooled connection for DDL. Both must be set (schema.prisma declares `directUrl`; `prisma generate`/`migrate` errors if it's unresolved). `sslmode=require` is explicit on both — verified the connection still succeeds with it enforced (not just relying on the default "prefer" behavior). |
| `RUN_MIGRATIONS_ON_BOOT` | unset (false) | unset (false) | `"true"` (Render only, no other target) | Read by `docker-entrypoint.sh`, not by the NestJS app itself. Render's free plan has no Pre-Deploy Command and is single-instance by construction, so migrations run at container start, before the app binds, instead of as a separate step — see `docs/DEPLOYMENT_FREE.md` "Migration procedure". Leave unset everywhere else; `docs/production/PRODUCTION_RUNBOOK.md` §3's separate-step guidance still applies whenever this is unset. |

**Supabase setup reference:**
1. Create a Supabase project (free tier). — done, project ref `xpxvvzwtvmcqkvugzfmd`.
2. Project Settings → Database → "Connection string": the **Transaction pooler** string (port 6543) for `DATABASE_URL`, and — since this environment has no IPv6 route — the **Session pooler** string (port 5432) for `DIRECT_URL` (Supabase's own documented IPv4-compatible alternative to the true Direct Connection for exactly this situation).
3. Percent-encode any reserved characters (`@`, `#`, `%`, `/`, `:`, etc.) inside the password portion of the URI — an unescaped `@` in a password is genuinely ambiguous for a URI parser (it's the same character that separates credentials from host) and was found and fixed during this setup.
4. Set both in Render's environment variables once Render is configured — not yet done.
5. Run `prisma migrate deploy` against `DIRECT_URL` as an explicit, separate deployment step (never auto-run on container start — see `docs/production/PRODUCTION_RUNBOOK.md`). — done.
6. Verify with `prisma migrate status`. — done, schema up to date, zero pending/conflicting migrations.

## AUTH

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `AUTH_JWT_SECRET` | `dev-only-jwt-secret-do-not-use-in-production` | same | freshly generated, unique | This project's one "session-shaped" secret — there is no separate `SESSION_SECRET`; refresh sessions are database rows re-validated per request, not a second signed-cookie scheme (see `docs/security/AUTH_MODEL.md`). |
| `AUTH_ACCESS_TOKEN_TTL_MINUTES` | `15` | `15` | `15` (or your policy) | |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | `7` | `7` | `7` (or your policy) | |
| `AUTH_LOGIN_MAX_ATTEMPTS` | `5` | `5` | `5` (or your policy) | |
| `AUTH_LOCKOUT_MINUTES` | `15` | `15` | `15` (or your policy) | |
| `AUTH_PASSWORD_RESET_TTL_MINUTES` | `30` | `30` | `30` (or your policy) | |
| `BOOTSTRAP_ADMIN_PASSWORD` | empty (falls back to dev default `ChangeMe!123`) | empty | **required** — a real, unique password | The seed script (`database/seeds/seed.ts`) refuses to run in production without this set; it never falls back to the dev default. |
| `AUTH_MFA_ENCRYPTION_KEY` | the committed example 32-byte hex value | same | freshly generated 32-byte hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | `assertProductionConfigSafe()` explicitly rejects the committed example value in production, even though it's a syntactically valid key. |
| `AUTH_MFA_ISSUER` | `"Abroad Scholarship System"` | same | same or your branding | |
| `AUTH_COOKIE_SECURE` | `false` (plain `http://localhost`) | `false` | unset/`true` (default) | `assertProductionConfigSafe()` rejects `false` in production. |

## STORAGE

**Connected**: Cloudflare R2 bucket `abroad-scholarship-documents` (account `d36f5cff4f75a0a34a92710adaf63c8d`) is the REMOTE DEMO storage target as of this task. Validated for real: bucket access, private access (no public URL), upload/scan/download, signed-URL properties, versioning, cross-user IDOR, file-security checks, and audit logging — see `docs/FREE_DEPLOY_CHECKLIST.md` "R2 connection verification" for the full record. No credential is recorded here or anywhere else in this repository; `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` live only in the local, git-ignored `.env` for now (to be moved into Render's environment-variable store, never a file, once Render is configured).

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `STORAGE_PROVIDER` | `local` | `local` | `r2` | `assertProductionConfigSafe()` rejects `local`/unset in production — Render's free-tier filesystem is ephemeral. |
| `DOCUMENT_STORAGE_DIR` | `storage/documents` | `storage/documents` | unused (R2 selected) | Only read by `LocalFilesystemStorageProvider`. |
| `R2_ACCOUNT_ID` | unused | unused | Cloudflare account ID — set | Used to derive the R2 endpoint. |
| `R2_ENDPOINT` | for local MinIO validation only: `http://localhost:9000` | same, if running `r2-storage-provider.e2e-spec.ts` | derived endpoint — set | Either this or `R2_ACCOUNT_ID` is required when `STORAGE_PROVIDER=r2`. |
| `R2_ACCESS_KEY_ID` | MinIO test credential (`minioadmin`) for local validation only | same | real R2 API token access key — set (value never logged/committed) | |
| `R2_SECRET_ACCESS_KEY` | MinIO test credential (`minioadmin123`) for local validation only | same | real R2 API token secret — set (value never logged/committed) | |
| `R2_BUCKET` | `abroad-documents-test` (MinIO) | same | `abroad-scholarship-documents` — set | |
| `DOCUMENT_SIGNING_SECRET` | `dev-only-document-signing-secret-not-for-production-use` | same | freshly generated, unique | Signs short-lived download tokens — independent of which `StorageProvider` is bound. |
| `DOCUMENT_DOWNLOAD_URL_TTL_SECONDS` | `60` | `60` | `60` (or your policy) | |
| `DOCUMENT_MAX_SIZE_BYTES` | `26214400` (25MB) | `26214400` | `26214400` (or your policy) | |

**R2 setup reference:**
1. Create an R2 bucket in the Cloudflare dashboard. — done, `abroad-scholarship-documents`.
2. Create an R2 API token scoped to that bucket (Account → R2 → Manage API Tokens). — done.
3. Record the Account ID, Access Key ID, Secret Access Key, and bucket name into Render's environment variables once Render is configured. — not yet done (values currently live only in local `.env`).
4. Validate the real bucket end-to-end (connection, upload/download, IDOR, cleanup). — done, see `docs/FREE_DEPLOY_CHECKLIST.md`.

## EMAIL

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `EMAIL_PROVIDER` | `log` | `log` | `log` (only implemented option) | `LogEmailProvider` logs recipient/event/subject only (never the body) and reports success — no real credentials required or consumed anywhere in this repository today. |
| `EMAIL_FROM` | empty | empty | reserved, empty | Documented placeholder for a future real provider. |
| `EMAIL_API_KEY` | empty | empty | reserved, empty | Same — never required to be a real value by anything in this codebase. Wiring a real provider (SES/Resend/SendGrid/etc.) is a single new class behind the existing `EmailProvider` interface (`apps/api/src/common/integrations/email-provider.interface.ts`) plus a `useClass`/`useFactory` change in `IntegrationsModule` — no domain-service change needed. |

## JOBS / SCHEDULER

Run in-process, inside the same web-service instance — there is no separate worker process or dyno to configure.

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `JOB_POLL_INTERVAL_MS` | `5000` | ignored (auto-start is skipped when `NODE_ENV=test`; tests drain explicitly) | `5000` (or tune) | |
| `SCHEDULER_INTERVAL_MS` | `60000` | ignored, same reason | `60000` (or tune) | |

**Free-tier caveat**: Render's free web services spin down after a period of inactivity and cold-start on the next request. While spun down, the in-process scheduler/poller is not running — a reminder sweep or scheduled job due during that window fires late, on the next request that wakes the instance, not at its originally-due time. See `docs/DEPLOYMENT_FREE.md` "free-tier limitations."

## WEBHOOK

| Variable | LOCAL | TEST | REMOTE DEMO | Notes |
|---|---|---|---|---|
| `ESIGN_WEBHOOK_SECRET` | `dev-only-esign-webhook-secret-not-for-production-use` | same (`webhooks.e2e-spec.ts` signs its own synthetic requests with this exact value) | freshly generated, unique — **must match whatever your real e-signature provider is configured to sign with**, if/when one is connected | Unset/empty means every webhook delivery is rejected (fails closed). |
