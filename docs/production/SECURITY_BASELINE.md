# Security Baseline — Phase 14

Consolidates the production security posture as of Phase 14, building on Phase 03's `docs/security/AUTH_MODEL.md`/`RBAC_MATRIX.md` and Phase 13's `docs/security/SECURITY_TEST_REPORT.md`. Every item below states what's actually implemented and verified, not an aspiration.

**Status note**: a subsequent go-live pre-flight attempt confirmed the "TLS/domain" and "Transport" gaps below (no real TLS termination, no domain) as explicit go-live blockers — see `docs/production/GO_LIVE_REPORT.md`.

## Transport / headers

| Control | Status | Detail |
|---|---|---|
| HTTPS/TLS | **Deployment responsibility, not application-level** | This process serves plain HTTP; TLS termination is expected at a reverse proxy/load balancer in front of it (see `PRODUCTION_RUNBOOK.md`). `Strict-Transport-Security` is already sent (via helmet) so browsers upgrade future requests once TLS is present. |
| Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP, CORP, HSTS) | **Implemented, verified live** | `helmet` (`main.ts`), `contentSecurityPolicy: default-src 'none'` (this is a JSON API — nothing for a permissive CSP to protect). Confirmed via a live smoke test: `curl -i http://localhost:3000/health` returns all of `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`. |
| CORS | **Implemented, closed by default** | `main.ts` — `origin: false` (no browser origin allowed) unless `CORS_ALLOWED_ORIGINS` is explicitly set (comma-separated allowlist). Never a wildcard: `credentials: true` is set for the refresh-cookie flow, which is invalid combined with `origin: '*'`. Verified live: a cross-origin `curl` with `Origin: https://evil.example.com` gets no `Access-Control-Allow-Origin` header back. |
| CSP | Covered above (helmet). | — |
| CSRF | **Not needed given current auth mechanism — verified reasoning, not an oversight** | Primary auth is a Bearer JWT (`Authorization` header) — cross-site requests cannot forge this. The one cookie in use (refresh token) is `httpOnly, Secure (default true), SameSite: Strict, path: /auth` — `SameSite=Strict` alone already blocks cross-site delivery, including top-level navigation. No CSRF token exists; none is required by this combination. (Phase 13 `SECURITY_TEST_REPORT.md` §7 reached the same conclusion.) |

## Cookies / sessions

- Refresh-token cookie: `httpOnly: true`, `secure` (defaults to `true`, only overridable to `false` via `AUTH_COOKIE_SECURE=false` for local `http://` dev — **`main.ts`'s `assertProductionConfigSafe()` refuses to start if this is `false` while `NODE_ENV=production`**), `sameSite: 'strict'`, scoped to `path: /auth`.
- Access token: short-lived JWT (`AUTH_ACCESS_TOKEN_TTL_MINUTES`, default 15 min), Bearer header only, never a cookie.
- Refresh token: rotated on every use (`SessionService.rotate`) — a used refresh token cannot be replayed. `AUTH_REFRESH_TOKEN_TTL_DAYS` (default 7 days).
- **Session revocation is live, not just expiry-based**: `AuthContextMiddleware` re-validates the session row against the database on *every* request (not a cached/stateless-only JWT check) — offboarding/suspension takes effect on the very next request, satisfying SRS AC-14. Verified in Phase 13's audit.

## Brute-force / rate limiting

- **Account lockout** (Phase 03): configurable failed-attempt threshold (`AUTH_LOGIN_MAX_ATTEMPTS`, default 5) locks the account for `AUTH_LOCKOUT_MINUTES` (default 15).
- **General API rate limiting** (Phase 14, closes `docs/ASSUMPTIONS.md` ASM-56): `@nestjs/throttler`, global default `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` (default 120 req/60s) per IP, applied to every route via `APP_GUARD`. Verified live: response headers `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`X-RateLimit-Reset` present on a real request.
- **Login-specific tighter limit**: `POST /auth/login` additionally carries `@Throttle({ limit: 10, ttl: 60_000 })` — bounds distributed account-guessing across many usernames from one IP, on top of the per-account lockout above. Verified live (`X-RateLimit-Limit: 10` observed on a real login attempt).
- Rate limiting is fully bypassed when `NODE_ENV=test` (mirrors the established `JobsModule`/`SchedulerModule` pattern) — confirmed via a full regression run producing zero rate-limit-caused failures.
- **Known scaling limitation**: in-memory throttler storage is single-instance-scoped. A multi-instance deployment needs a shared store (e.g. Redis-backed `ThrottlerStorage`) for limits to hold across instances — not built (no such infrastructure exists in this environment).

## MFA / password policy

- MFA: TOTP-based (`otplib`), secret encrypted at rest (`AUTH_MFA_ENCRYPTION_KEY`, AES-256-GCM, deliberately separate key from `AUTH_JWT_SECRET`), issuer configurable (`AUTH_MFA_ISSUER`). Backup codes per SRS §6.1.
- Password reset: token TTL `AUTH_PASSWORD_RESET_TTL_MINUTES` (default 30), single-use, no user-enumeration signal (always returns success regardless of whether the email exists).
- Password minimum length: 8 characters (`PasswordResetConfirmDto`). No additional complexity rule is specified anywhere in the SRS beyond MFA + lockout, so none was invented.

## Webhook / signed-URL / upload security (Phase 12, re-verified Phase 13-14)

- Webhook signatures verified via HMAC-SHA256 against the raw request body (captured before JSON parsing specifically for this) — verification happens *before* any database mutation, and even a rejected/forged delivery is recorded+audited (never silently dropped). Replay protection is `(source, eventId)`-unique; Phase 13 fixed a forged-delivery slot-squatting gap so a forged attempt under a guessed `eventId` can never permanently block the later legitimate delivery.
- Signed document-download URLs: HMAC-SHA256, short TTL (`DOCUMENT_DOWNLOAD_URL_TTL_SECONDS`, default 60s), constant-time signature comparison, scoped to `(documentId, principalId)` — a token issued to one principal is rejected for another even before expiry. Live grant + live malware-scan status re-checked on every use (a grant revoked or a document re-flagged INFECTED between issuing and using the URL takes effect immediately).
- Upload validation chain: MIME allowlist + magic-byte check + extension check + size cap, all before storage; malware scan (EICAR-signature heuristic, honestly documented as a stand-in — see `docs/ASSUMPTIONS.md` ASM-50) gates download until `scanStatus=CLEAN` for everyone, including the uploader and GLOBAL-scope roles.

## IDOR / access control

Phase 13 found and fixed the one CRITICAL IDOR (student-list `?search=` scope-filter collision) and 3 HIGH access-control gaps (document-download authorization parity, Consultant visa-evidence over-grant, guard-level-denial audit gap) — see `docs/security/SECURITY_TEST_REPORT.md` for full detail. Phase 14's Final Architect Review additionally found and fixed a commission/partner-attribution integrity gap (`docs/FINAL_ARCHITECT_REVIEW.md`). All record-level reads return 404 (not 403) for an out-of-scope-but-existing record — no existence-enumeration signal (SRS AC-02).

## Audit integrity

- Every sensitive mutation is `@Audit`-decorated with actor/action/entity/timestamp/result/IP/user-agent/before-after-diff/student-case-context.
- Phase 13 fixed a real gap: guard-level (403) permission denials previously never reached the audit interceptor (NestJS runs Guards before Interceptors) — `AuthGuard` now writes the DENIED row itself.
- No hard-delete path exists anywhere in the codebase (Hard Rule #5) — audit history is append-only by construction, not by a database-level immutability trigger (not built; see Known Risks below).

## Secret management

- No real secret is committed to the repository — `.env` (git-ignored) holds explicitly-labeled dev-only placeholder values (`dev-only-*-not-for-production-use`); `.env.example` holds the same pattern plus one syntactically-valid-but-publicly-known example key (`AUTH_MFA_ENCRYPTION_KEY`) that's explicitly called out as such in its own comment.
- **Boot-time production config validation** (new, Phase 14): `assertProductionConfigSafe()` (`apps/api/src/common/config/assert-production-config.ts`) refuses to start when `NODE_ENV=production` and any required secret (`AUTH_JWT_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`, `DOCUMENT_SIGNING_SECRET`, `ESIGN_WEBHOOK_SECRET`, `DATABASE_URL`) is missing or still equals a known dev/example placeholder, or `AUTH_COOKIE_SECURE=false`. Verified live: a real Docker container boot with a properly-generated secret set and `NODE_ENV=production` started cleanly; an earlier attempt with a malformed key correctly crashed at the DI-construction stage (a second, independent check inside `MfaEncryption`'s own constructor).
- **Bootstrap admin credential** (new, Phase 14 fix — a real finding, not a hypothetical): `database/seeds/seed.ts` previously created the bootstrap `admin`/SYSTEM_ADMIN account with a fixed, source-committed password (`ChangeMe!123`) unconditionally, in every environment including production. It now requires `BOOTSTRAP_ADMIN_PASSWORD` whenever `NODE_ENV=production` and fails the seed run (never falls back to the default) if it's absent — verified live against an isolated scratch database: the seed failed with a clear error without the variable set, and succeeded with exactly one `admin` row (zero demo fixtures) once it was supplied. This is a separate check from `assertProductionConfigSafe()` above (the seed script is a distinct process from the running API), documented in `PRODUCTION_RUNBOOK.md` §3.
- Secrets are never logged (`ErrorContractFilter` never includes exception internals in the client response or in any code path that touches request bodies containing secrets; explicit code comments on every secret-bearing field say "Never log this value").
- No secret is ever returned in an API response body.
- Production secret storage mechanism (a real secret manager — AWS Secrets Manager, Vault, etc.) is a deployment-environment concern, not something this repository can provision — see `PRODUCTION_RUNBOOK.md` prerequisites.

## Dependency / supply-chain

- `npm audit --omit=dev`: 3 HIGH advisories, all the same root cause — `deepmerge-ts` (a transitive dependency of `@prisma/config`, itself only pulled in by the `prisma` CLI devDependency, never by the running application's `@prisma/client` runtime dependency). Not exploitable via any application request path (the CLI only merges its own local config files, never attacker-controlled input). The suggested `npm audit fix --force` would downgrade `prisma` to 6.12.0, a real regression — not applied. Documented, accepted risk; re-evaluate when Prisma publishes a patched release in the current major version.
- Lockfile: single `package-lock.json` at the workspace root (npm workspaces), no competing lockfile (yarn.lock/pnpm-lock.yaml) — consistent package manager throughout.
- Runtime: Node 22 (LTS), pinned in the Docker image (`node:22-alpine`); one non-blocking `EBADENGINE` warning (a devDependency, `eslint-visitor-keys`, wants Node ≥22.13.0; the environment runs 22.11.0) — recommend bumping the Node patch version opportunistically, not a security issue.

## Known risks / accepted limitations (see `docs/phase-status/PHASE_14.md` for the full, triaged list)

- Rate-limit storage is single-instance-scoped (above).
- Document storage is local-disk, single-instance (see next section).
- No automated off-host backup job is provisioned in this environment (`docs/ASSUMPTIONS.md` ASM-61) — a **production blocker**, not accepted.
- No real TLS termination exists in this repository (deployment responsibility).
- No AuditLog database-level immutability trigger (append-only by application discipline, not by a `REVOKE UPDATE/DELETE` grant or trigger) — low risk given no code path ever issues such a write, but not defense-in-depth against a compromised DB credential.

## Storage (Document subsystem) — production classification

**ACCEPTED LIMITATION for a single-instance deployment; PRODUCTION BLOCKER for a multi-instance/horizontally-scaled deployment.**

The default `LocalFilesystemStorageProvider` (Phase 12) writes uploaded document bytes to local disk (`DOCUMENT_STORAGE_DIR`). This is fine for exactly one running application instance with a persistent volume attached and included in the host's own backup routine — it becomes unsafe the moment a second instance is added (each instance would see a different, incomplete set of files; a document uploaded to instance A is invisible to a request served by instance B) or the instance is replaced without volume continuity (all documents lost).

**Migration path** (not implemented — no cloud credentials exist in this environment, and building one now would be untested, unverifiable configuration): the `StorageProvider` interface (`storage-provider.interface.ts`) is already the seam — swapping in an S3-compatible provider (AWS S3, MinIO, DigitalOcean Spaces, etc.) is a single `useClass` change in `storage.module.ts`, no controller/service/Document-interface change needed. This was a deliberate Phase 12 design decision specifically so this swap would be low-risk when the target environment is known.
