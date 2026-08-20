# AUTH MODEL — Phase 03A

Reference implementation: `apps/api/src/modules/identity/auth/`. This document explains
the *why* behind the design; the code comments explain the *what* at each call site.

## 1. Session model: short-lived stateless access token + DB-checked session row

**The problem**: a pure stateless JWT access token cannot support "revoke session đang
hoạt động" (SRS AC-14) — once issued, it keeps working until its own expiry no matter what
an admin does (suspend the user, offboard them, an explicit "log out this device" click).
A pure server-side session (no JWT at all) supports instant revocation but re-adds a DB
round-trip to *every* authenticated request that stateless JWTs exist to avoid.

**The decision**: both, deliberately overlapping:

- The access token is a short-lived (`AUTH_ACCESS_TOKEN_TTL_MINUTES`, default 15) signed
  JWT carrying `{ sub: userId, roleCode, jti: sessionId }`.
- `jti` is the id of a real `sessions` row. `AuthContextMiddleware` verifies the JWT
  signature/expiry AND looks up that `sessions` row on every request — not found, revoked,
  or expired → treated as anonymous.
- The row's own `expiresAt` (`AUTH_REFRESH_TOKEN_TTL_DAYS`, default 7) is what the
  *refresh* token is checked against; the access token's own 15-minute expiry is a second,
  independent clock.

**What this buys**: explicit revocation (logout, admin-revoke, suspend, offboard, password
reset) takes effect on the *very next request* — verified directly by
`apps/api/test/auth.e2e-spec.ts` "revoked session". The cost is one indexed DB lookup per
authenticated request, which is an accepted, deliberate trade-off at this project's current
scale — see `docs/architecture/TARGET_ARCHITECTURE.md` section 5 (Redis/BullMQ queue infra
is planned for a later phase; a session-validity cache is the natural place to remove this
cost once that infra exists, not before).

Because the session-row check runs on *every* request (not just at token issuance),
revocation is effectively immediate in this implementation — the access token's own
15-minute expiry is not what makes revocation work. It's kept short anyway as
defense-in-depth: it bounds how long a caller stays authenticated if the session-row check
were ever accidentally bypassed by a future change (e.g. a new route wired outside the
global middleware).

## 2. Refresh tokens: opaque, hashed at rest, single-use with rotation

- The refresh token itself is an opaque random value (`generateOpaqueToken`,
  `crypto.randomBytes(32)`, base64url) — not a JWT. Only its SHA-256 hash
  (`sessions.refresh_token_hash`) is stored; the raw value is shown to the caller exactly
  once (the login/refresh response body + cookie).
- `POST /auth/refresh` **rotates**: the presented refresh token is revoked and a brand new
  `(accessToken, refreshToken)` pair is issued under a new session row. Presenting an
  already-rotated (or otherwise revoked/expired) refresh token is rejected as
  `401 INVALID_REFRESH_TOKEN` — the standard mitigation against a leaked refresh token
  being replayed silently after the legitimate client has already rotated past it.

## 3. Transport: httpOnly cookie + response body, both

`AUTH_COOKIE_SECURE` (default true, must be explicitly set `false` for local http://
development — see `.env.example`) controls the `Secure` flag. The refresh token is set as
an `httpOnly`, `SameSite=Strict`, `path=/auth` cookie (`01_AUTH.md` "secure cookies/token
handling") **and** returned in the JSON response body. Both, because:

- No frontend web app exists in this repository yet at any phase (see
  `docs/ASSUMPTIONS.md` ASM-08) — when one is built, it should prefer the cookie and never
  touch the body value for storage.
- Non-browser clients (mobile, service-to-service, this project's own integration tests)
  have no cookie jar concept the same way and need the body value.

The access token is only ever returned in the body — it is meant to be sent as
`Authorization: Bearer <token>`, never as a cookie (cookies are automatically attached by
the browser to every request including cross-site ones without an explicit opt-in, which
is exactly the CSRF surface a bearer-header token avoids).

## 4. Login error codes: generic where enumeration matters, specific where it doesn't

SRS 6.1 "no verbose auth errors" is applied selectively, not as a blanket rule:

| Scenario | Code | Status | Reasoning |
|---|---|---|---|
| Unknown username | `INVALID_CREDENTIALS` | 401 | Same code as a wrong password — a caller must not be able to distinguish "no such user" from "wrong password". |
| Wrong password | `INVALID_CREDENTIALS` | 401 | Same as above. |
| Account locked (brute-force threshold crossed) | `ACCOUNT_LOCKED` | 423 | Deliberately distinguishable — SRS itself names "locked account" as a distinct test scenario, and the legitimate account owner benefits from knowing they're locked out (vs. silently getting "wrong password" forever, which would be worse UX for no real security gain — an attacker who has already triggered the lockout already knows they've been guessing wrong). |
| Account suspended | `ACCOUNT_SUSPENDED` | 403 | Same reasoning as locked — an operational state worth surfacing, not a secret. |
| Account offboarded | `ACCOUNT_OFFBOARDED` | 403 | Same. |
| Wrong MFA code | `INVALID_MFA_CODE` | 401 | Only reachable after a correct password, so no enumeration concern remains — the caller already proved they have a valid credential. |
| Wrong password-reset token | `INVALID_OR_USED_RESET_TOKEN` | 409 | Deliberately does NOT distinguish "wrong/unknown token" from "already used" (replay prevention: a replay attempt should learn nothing new). |

## 5. MFA: TOTP + hashed single-use backup codes, encrypted secret at rest

- `otplib`'s `authenticator` (RFC 6238 TOTP). Enrollment requires an already-authenticated
  session (`POST /auth/mfa/enroll`) — there is no unauthenticated MFA-enrollment surface.
- The TOTP secret is encrypted at rest (AES-256-GCM,
  `common/security/mfa-encryption.util.ts`) using `AUTH_MFA_ENCRYPTION_KEY` — a key
  deliberately **separate** from `AUTH_JWT_SECRET` so a JWT-secret leak alone doesn't also
  expose every enrolled MFA secret. Unlike a password, the secret must be recoverable (the
  server needs the plaintext to compute the expected TOTP code every login), so it can't be
  one-way hashed the way `AUTH_JWT_SECRET`-adjacent values are.
- Backup codes are hashed (`common/security/token.util.ts` `hashOpaqueToken`, SHA-256) and
  single-use — consuming one immediately marks it used in the same call. SRS 6.1 "backup
  code được mã hóa" is satisfied by hashing rather than reversible encryption, since backup
  codes (unlike the TOTP secret) never need to be recovered/re-displayed — only compared.
- **Re-enrollment while already enabled is refused** (`409 MFA_ALREADY_ENABLED`) — a
  stolen-but-valid access token must not be able to silently swap out a working MFA device
  without the holder also proving control of a *new* authenticator (which would require a
  staged "pending secret, confirm-then-swap" flow this phase does not implement — see the
  code comment on `MfaService.startEnrollment`). Disabling MFA outright is also not
  implemented in this phase. Both are acceptable phase-scope limitations, not silent
  security gaps: refusing is the safe default, not a bypass.

## 6. Password hashing

`scrypt` (Node's built-in `crypto.scryptSync`), 64-byte derived key, random 16-byte salt
per password, stored as `scrypt$<saltHex>$<hashHex>`. Verification uses
`crypto.timingSafeEqual` rather than `===` (constant-time comparison — SRS "no verbose auth
errors" extended to not leaking match-length via timing either). `bcrypt`/`argon2` were not
added as dependencies solely to keep the native-module footprint of this Windows-hosted dev
environment smaller; `scrypt` is a real, well-regarded KDF (RFC 7914), not a placeholder.

## 7. What is explicitly NOT in this phase

- WebAuthn (SRS says "khuyến nghị TOTP hoặc WebAuthn" — TOTP alone satisfies the
  requirement; WebAuthn is a suggested alternative, not a second mandatory factor type).
- OAuth2/OIDC federation (`docs/architecture/TARGET_ARCHITECTURE.md` section 16 lists it as
  a later option "nếu doanh nghiệp có identity provider" — local auth + MFA is the chosen
  path per that same document, for now).
- Mandatory org-wide MFA enrollment rollout (the mechanism fully supports it; turning it on
  for every internal account is an operational rollout decision, not a technical gap).
