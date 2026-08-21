/// Auth/session types (F02 — see docs/frontend/FRONTEND_AUTH.md). Every shape here mirrors
/// a real backend response verbatim (apps/api/src/modules/identity/auth/*.controller.ts) —
/// nothing invented ahead of the backend contract.

/// The backend's `RoleCode` enum (`database/schema.prisma`), copied as a literal union since
/// no shared-types package exists (`docs/frontend/FRONTEND_ARCHITECTURE.md` "Types
/// boundary"). Uses the CORRECT value `DOCUMENT_SPECIALIST` — see
/// `docs/frontend/FRONTEND_PERMISSION_MAP.md` "Role code discrepancy".
export type RoleCode =
  | "EXECUTIVE_DIRECTOR"
  | "DEPARTMENT_MANAGER"
  | "CONSULTANT"
  | "DOCUMENT_SPECIALIST"
  | "SALES_MARKETING"
  | "ADMIN_FINANCE"
  | "STUDENT_PARENT"
  | "SYSTEM_ADMIN";

/// GET /auth/me's actual response shape (AuthController.me returns the raw `Principal`
/// object, nothing more — see the "Known backend gap" note in FRONTEND_AUTH.md: no
/// username/fullName is recoverable from this endpoint).
export interface Principal {
  userId: string;
  roleCode: RoleCode;
  sessionId: string;
}

/// The `user` object POST /auth/login (and /auth/mfa/login-verify) return alongside tokens —
/// richer than `Principal`, but ONLY available at the moment of an actual login, never from
/// a silent session restore. See `AuthProvider`'s `displayUser` vs `principal` distinction.
export interface LoginUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
}

export interface LoginSuccessResponse {
  accessToken: string;
  refreshToken: string; // intentionally never persisted client-side — see token-store.ts
  expiresInMinutes: number;
  user: LoginUser;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = LoginSuccessResponse | MfaRequiredResponse;

export function isMfaRequired(response: LoginResponse): response is MfaRequiredResponse {
  return "mfaRequired" in response && response.mfaRequired === true;
}
