/// Cross-cutting response-envelope types mirrored verbatim from docs/api/API_CONVENTIONS.md
/// §4 (pagination) and §5 (error contract) — the ONLY two shapes every backend endpoint
/// shares. Per-domain DTOs (Student, Case, Contract, ...) are NOT modeled here — that is
/// F02+/domain-phase scope, built against the real backend response shape at the time each
/// domain is implemented, not guessed in advance.

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/// Display-safe user summary — mirrors the `select: { id, username, fullName }` shape every
/// owner/member relation across the CRM domain uses (docs/DECISIONS.md DEC-09), never the
/// full User row. Shared here (not per-domain) since Lead/Case/CaseMember all embed it
/// identically.
export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
}

/// docs/api/API_CONVENTIONS.md §5 — every error response, without exception, has this shape.
/// `[extra: string]: unknown` mirrors the backend filter's own pass-through behavior
/// (`error-contract.filter.ts` "extra" handling) — a specific thrown error can carry extra
/// top-level fields beyond code/message/requestId/details (e.g. `lockedUntil` on
/// `ACCOUNT_LOCKED`, `candidates` on a duplicate-detection 409, `allowedTransitions` on an
/// FSM violation).
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
    [extra: string]: unknown;
  };
}

/// Thrown by the API client (lib/api/client.ts) for any non-2xx response, so callers can
/// branch on `status`/`code` instead of parsing a raw fetch Response. The 401/403/404
/// semantics themselves (401 = unauthenticated, 403 = permission denied, 404 = not found OR
/// out-of-scope — deliberately indistinguishable, docs/security/RBAC_MATRIX.md §3
/// "why 404 not 403") are documented in docs/frontend/FRONTEND_API_MAP.md; this type only
/// carries the data, it does not itself decide what a caller should render.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: unknown;
  /** The full raw `error` object — for the rare extra field (e.g. `lockedUntil`) a specific caller needs. */
  readonly raw: ApiErrorBody["error"];

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    this.requestId = body.error.requestId;
    this.details = body.error.details;
    this.raw = body.error;
  }
}
