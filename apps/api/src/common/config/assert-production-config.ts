/// Phase 14 hardening — 14-production/01_PRODUCTION_HARDENING.md "No debug mode. No
/// secrets in repository." Every one of these values is a real, committed dev/example
/// placeholder (`.env` and `.env.example` — never a real secret, both files carry an
/// explicit "never use in production" comment) that must NEVER reach a live deployment
/// unchanged. This only runs — and only ever fails startup — when `NODE_ENV=production`;
/// every other environment (dev, `test`) is completely unaffected. Fails fast (throws
/// before `app.listen()`) rather than silently booting with an unsafe value, since the
/// consequence of missing this (e.g. `AuthService.requestPasswordReset`'s dev-only token
/// leak gate, `PortalAccessService`'s equivalent) is a real security hole, not a cosmetic
/// issue.
const KNOWN_DEV_PLACEHOLDER_VALUES = new Set([
  'change-me-in-phase-03',
  'change-me-in-phase-12',
  'dev-only-jwt-secret-do-not-use-in-production',
  'dev-only-document-signing-secret-not-for-production-use',
  'dev-only-esign-webhook-secret-not-for-production-use',
  // The literal 32-byte hex value committed in .env.example as a syntactically-valid
  // placeholder (MfaEncryption's constructor only validates length/format, not
  // "is this the well-known example value") — see mfa-encryption.util.ts.
  'a73f7fd82e8c3dfbbe66f845d2020c26996816e8aefe75d189e9388fb0d8645b',
]);

const REQUIRED_SECRET_ENV_VARS = ['AUTH_JWT_SECRET', 'AUTH_MFA_ENCRYPTION_KEY', 'DOCUMENT_SIGNING_SECRET', 'ESIGN_WEBHOOK_SECRET', 'DATABASE_URL'] as const;

export function assertProductionConfigSafe(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];

  for (const key of REQUIRED_SECRET_ENV_VARS) {
    const value = env[key];
    if (!value) {
      problems.push(`${key} is not set.`);
      continue;
    }
    if (KNOWN_DEV_PLACEHOLDER_VALUES.has(value)) {
      problems.push(`${key} is still set to a known development/example placeholder value — generate a real production secret (see .env.example's comments).`);
    }
  }

  // `AUTH_COOKIE_SECURE` defaults to true (see AuthController.setRefreshCookie) — this only
  // fires if an operator explicitly opted OUT of Secure for a production deployment.
  if (env.AUTH_COOKIE_SECURE === 'false') {
    problems.push('AUTH_COOKIE_SECURE=false in production — the refresh-token cookie would be sent over plain HTTP.');
  }

  // Free-remote-deployment prep — Render's free-tier web-service filesystem is ephemeral
  // (does not survive a deploy/restart), so `STORAGE_PROVIDER=local`/unset in production
  // would silently lose every uploaded document on the next redeploy. `storage.module.ts`'s
  // factory would still boot successfully with local storage (it's a valid choice for a
  // deployment with a real persistent volume) — this check is what stops that "local-only
  // fallback silently activating" specifically for THIS project's actual free-tier target.
  const storageProvider = (env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (storageProvider === 'local') {
    problems.push('STORAGE_PROVIDER is "local" (or unset) in production — a persistent-volume-backed deployment may accept this deliberately, but the default free-tier target (Render) has an ephemeral filesystem; set STORAGE_PROVIDER=r2 with real R2 credentials, or explicitly confirm a persistent volume is attached if local storage is genuinely intended.');
  } else if (storageProvider === 'r2') {
    for (const key of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
      if (!env[key]) problems.push(`${key} is not set (required when STORAGE_PROVIDER=r2).`);
    }
    if (!env.R2_ENDPOINT && !env.R2_ACCOUNT_ID) {
      problems.push('Neither R2_ENDPOINT nor R2_ACCOUNT_ID is set (one is required when STORAGE_PROVIDER=r2, to know which R2 endpoint to talk to).');
    }
  }

  // NFR-SEC-01 deny-by-default extends to CORS — a wildcard origin combined with
  // `credentials: true` (the refresh-cookie flow) is both invalid per the CORS spec and,
  // where a browser would still accept it for non-credentialed requests, a real policy
  // violation for a system holding financial/identity data.
  if (env.CORS_ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).includes('*')) {
    problems.push('CORS_ALLOWED_ORIGINS contains "*" in production — set explicit origin(s) instead of a wildcard.');
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to start with NODE_ENV=production and unsafe configuration:\n- ${problems.join('\n- ')}`);
  }
}
