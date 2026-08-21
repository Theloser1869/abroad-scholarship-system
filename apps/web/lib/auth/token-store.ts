/// In-memory-only access-token store (F02 — see docs/frontend/FRONTEND_AUTH.md "Token
/// storage strategy"). Deliberately NOT `localStorage`/`sessionStorage`: the backend issues
/// a short-lived (15 min) JWT access token meant for the `Authorization: Bearer` header
/// (docs/security/AUTH_MODEL.md §3 — "The access token is only ever returned in the body...
/// meant to be sent as Authorization: Bearer, never as a cookie"), and any JS-readable
/// browser storage is exactly the XSS exfiltration surface a bearer token in memory avoids.
/// The refresh token is never stored here at all — the httpOnly `refresh_token` cookie the
/// backend sets is the only copy that should ever exist client-side (AUTH_MODEL.md §3: "when
/// one [frontend] is built, it should prefer the cookie and never touch the body value for
/// storage" — this client discards the `refreshToken` field of every login/refresh response
/// body on purpose, see `lib/auth/auth-api.ts`).
///
/// Trade-off accepted deliberately: a full page reload loses this in-memory token, so every
/// reload re-authenticates via a silent `POST /auth/refresh` (cookie-driven) — see
/// `bootstrapSession()` in `session.ts`. This is the standard "memory + httpOnly refresh
/// cookie" pattern, not an oversight.

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/// Session-expired notification (F02 scope — see docs/frontend/FRONTEND_AUTH.md "Refresh
/// flow"). `lib/api/client.ts` calls this once a refresh definitively fails (not on every
/// 401 — only when there is no way to recover the session). `AuthProvider` is the one
/// subscriber, registered on mount, so a failed refresh anywhere in the app (any component's
/// API call) can transition auth state to UNAUTHENTICATED and redirect, without `lib/api/`
/// importing React or `AuthContext` (keeping the HTTP layer framework-agnostic).
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function onSessionExpired(listener: SessionExpiredListener | null): void {
  sessionExpiredListener = listener;
}

export function notifySessionExpired(): void {
  sessionExpiredListener?.();
}
