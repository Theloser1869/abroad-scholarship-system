/// The authenticated caller of the current request. Populated by
/// `AuthContextMiddleware` from a real access token issued by `POST /auth/login` (or MFA
/// verify / refresh). `sessionId` is the access token's `jti` claim, re-checked against
/// `sessions` on every request — see docs/security/AUTH_MODEL.md for why a "stateless" JWT
/// is still validated against a DB row (immediate revocation, SRS AC-14).
export interface Principal {
  userId: string;
  roleCode: string;
  sessionId: string;
}

declare module 'express' {
  interface Request {
    principal: Principal | null;
  }
}
