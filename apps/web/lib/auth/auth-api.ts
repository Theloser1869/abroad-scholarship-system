import { apiFetch, refreshSession } from "../api/client";
import { clearAccessToken, setAccessToken } from "./token-store";
import type { LoginResponse, Principal } from "./session";

/// Typed calls against `apps/api/src/modules/identity/auth/auth.controller.ts` /
/// `mfa.controller.ts` — the only file allowed to know these specific auth routes (every
/// other module goes through `apiFetch` generically, per `lib/api/client.ts`'s own scope
/// note). All four mark `skipAuthRetry: true` — see the comment on `AUTH_ENDPOINTS_NO_RETRY`
/// in `client.ts` for why.

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
    skipAuthRetry: true,
  });
  applyLoginResult(response);
  return response;
}

export async function mfaLoginVerify(mfaToken: string, code: string): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>("/auth/mfa/login-verify", {
    method: "POST",
    body: { mfaToken, code },
    skipAuthRetry: true,
  });
  applyLoginResult(response);
  return response;
}

/// `refreshToken` in the response body is intentionally never read/stored here — see
/// token-store.ts's file-level comment (docs/security/AUTH_MODEL.md §3).
function applyLoginResult(response: LoginResponse): void {
  if ("accessToken" in response) {
    setAccessToken(response.accessToken);
  }
}

/// GET /auth/me — returns only `Principal` (userId/roleCode/sessionId), never a display
/// name. See `docs/frontend/FRONTEND_AUTH.md` "Known backend gap: no display-name-bearing
/// self endpoint" for why `AuthProvider` cannot show a name after a silent-refresh restore.
export async function fetchMe(): Promise<Principal> {
  return apiFetch<Principal>("/auth/me", { skipAuthRetry: true });
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ loggedOut: true }>("/auth/logout", { method: "POST", skipAuthRetry: true });
  } finally {
    // Clear client state unconditionally — even if the network call itself failed (offline,
    // timeout), the user's intent was to leave the authenticated state, and staying
    // "logged in" locally while the backend call is unknown-status is worse than the reverse.
    clearAccessToken();
  }
}

/// Silent session restore on app start — the one legitimate direct caller of
/// `refreshSession()` outside `lib/api/client.ts`'s own 401-retry path. Reuses the exact
/// same single-flight lock (see client.ts), so a bootstrap-triggered refresh and a
/// 401-triggered refresh occurring at the same instant still only ever hit
/// `POST /auth/refresh` once.
export { refreshSession };
