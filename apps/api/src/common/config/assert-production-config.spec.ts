import { assertProductionConfigSafe } from './assert-production-config';

const SAFE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  AUTH_JWT_SECRET: 'a-real-generated-production-secret',
  AUTH_MFA_ENCRYPTION_KEY: 'ff'.repeat(32),
  DOCUMENT_SIGNING_SECRET: 'another-real-generated-production-secret',
  ESIGN_WEBHOOK_SECRET: 'yet-another-real-production-secret',
  DATABASE_URL: 'postgresql://prod-user:prod-pass@prod-host:5432/prod-db',
  STORAGE_PROVIDER: 'r2',
  R2_ACCOUNT_ID: 'a-real-r2-account-id',
  R2_ACCESS_KEY_ID: 'a-real-r2-access-key-id',
  R2_SECRET_ACCESS_KEY: 'a-real-r2-secret-access-key',
  R2_BUCKET: 'a-real-r2-bucket-name',
};

describe('assertProductionConfigSafe', () => {
  it('does nothing outside production', () => {
    expect(() => assertProductionConfigSafe({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionConfigSafe({ NODE_ENV: 'test' })).not.toThrow();
    expect(() => assertProductionConfigSafe({})).not.toThrow();
  });

  it('passes with a fully-safe production configuration', () => {
    expect(() => assertProductionConfigSafe(SAFE_ENV)).not.toThrow();
  });

  it('rejects a missing required secret', () => {
    const env = { ...SAFE_ENV, AUTH_JWT_SECRET: undefined };
    expect(() => assertProductionConfigSafe(env)).toThrow(/AUTH_JWT_SECRET is not set/);
  });

  it.each(['change-me-in-phase-03', 'change-me-in-phase-12', 'dev-only-jwt-secret-do-not-use-in-production', 'dev-only-document-signing-secret-not-for-production-use', 'dev-only-esign-webhook-secret-not-for-production-use', 'a73f7fd82e8c3dfbbe66f845d2020c26996816e8aefe75d189e9388fb0d8645b'])(
    'rejects the known dev/example placeholder value %s wherever it appears',
    (placeholder) => {
      const env = { ...SAFE_ENV, AUTH_JWT_SECRET: placeholder };
      expect(() => assertProductionConfigSafe(env)).toThrow(/known development\/example placeholder value/);
    },
  );

  it('rejects AUTH_COOKIE_SECURE=false in production', () => {
    const env = { ...SAFE_ENV, AUTH_COOKIE_SECURE: 'false' };
    expect(() => assertProductionConfigSafe(env)).toThrow(/AUTH_COOKIE_SECURE=false/);
  });

  it('rejects STORAGE_PROVIDER=local (or unset) in production — Render free tier has an ephemeral filesystem', () => {
    const unset = { ...SAFE_ENV, STORAGE_PROVIDER: undefined };
    expect(() => assertProductionConfigSafe(unset)).toThrow(/STORAGE_PROVIDER is "local"/);
    const explicit = { ...SAFE_ENV, STORAGE_PROVIDER: 'local' };
    expect(() => assertProductionConfigSafe(explicit)).toThrow(/STORAGE_PROVIDER is "local"/);
  });

  it.each(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'])('rejects STORAGE_PROVIDER=r2 missing %s', (key) => {
    const env = { ...SAFE_ENV, [key]: undefined };
    expect(() => assertProductionConfigSafe(env)).toThrow(new RegExp(`${key} is not set`));
  });

  it('rejects STORAGE_PROVIDER=r2 with neither R2_ENDPOINT nor R2_ACCOUNT_ID set', () => {
    const env = { ...SAFE_ENV, R2_ACCOUNT_ID: undefined };
    expect(() => assertProductionConfigSafe(env)).toThrow(/Neither R2_ENDPOINT nor R2_ACCOUNT_ID/);
  });

  it('accepts STORAGE_PROVIDER=r2 configured via R2_ENDPOINT instead of R2_ACCOUNT_ID', () => {
    const env = { ...SAFE_ENV, R2_ACCOUNT_ID: undefined, R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com' };
    expect(() => assertProductionConfigSafe(env)).not.toThrow();
  });

  it('rejects a wildcard CORS origin in production', () => {
    const env = { ...SAFE_ENV, CORS_ALLOWED_ORIGINS: '*' };
    expect(() => assertProductionConfigSafe(env)).toThrow(/CORS_ALLOWED_ORIGINS contains "\*"/);
    const mixed = { ...SAFE_ENV, CORS_ALLOWED_ORIGINS: 'https://example.com, *' };
    expect(() => assertProductionConfigSafe(mixed)).toThrow(/CORS_ALLOWED_ORIGINS contains "\*"/);
  });

  it('accepts explicit CORS origins in production', () => {
    const env = { ...SAFE_ENV, CORS_ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com' };
    expect(() => assertProductionConfigSafe(env)).not.toThrow();
  });

  it('reports every problem at once, not just the first', () => {
    const env = { ...SAFE_ENV, AUTH_JWT_SECRET: undefined, AUTH_COOKIE_SECURE: 'false' };
    try {
      assertProductionConfigSafe(env);
      fail('expected assertProductionConfigSafe to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/AUTH_JWT_SECRET is not set/);
      expect(message).toMatch(/AUTH_COOKIE_SECURE=false/);
    }
  });
});
