import { ApiError, type ApiErrorBody } from "./types";
import {
  clearAccessToken,
  getAccessToken,
  notifySessionExpired,
  setAccessToken,
} from "../auth/token-store";

/// Centralized API client (F02 — see docs/frontend/FRONTEND_AUTH.md and
/// docs/frontend/FRONTEND_API_MAP.md §1). The ONLY module allowed to call `fetch` against
/// the backend — no component/hook ever calls `fetch`/`axios` directly
/// (`frontend_prompts` §4). Responsibilities: base URL resolution, `Authorization: Bearer`
/// attachment, httpOnly-cookie credential forwarding, the one error-contract shape
/// (`{ error: {...} }` → `ApiError`), request timeout, and a single-flight refresh-on-401
/// retry (see §"401 handling" below). Domain-specific typed calls are NOT implemented here
/// (per F01/F02 scope — `apiFetch` is the generic primitive every domain phase builds on).

/// F11A same-origin proxy: `NEXT_PUBLIC_API_URL` is now legitimately either an absolute
/// origin (local dev, `http://localhost:3000`) OR a same-origin relative path (production/
/// demo, `/api` — proxied to the real backend by `next.config.ts`'s `rewrites()`). Both must
/// work identically here.
function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set — copy apps/web/.env.example to apps/web/.env.local and fill in the backend URL.",
    );
  }
  return url.replace(/\/+$/, "");
}

const DEFAULT_TIMEOUT_MS = 30_000;

/// Paths that must never trigger the 401→refresh→retry dance below, or a failed
/// login/refresh attempt itself would recursively try to "refresh" its way out of an
/// INVALID_CREDENTIALS/INVALID_REFRESH_TOKEN response. `auth-api.ts` also passes
/// `skipAuthRetry: true` explicitly on these calls as a second, redundant safeguard.
const AUTH_ENDPOINTS_NO_RETRY = ["/auth/login", "/auth/refresh", "/auth/mfa/login-verify", "/auth/logout"];

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON-serializable request body — the client sets Content-Type/serializes it. */
  body?: unknown;
  /** Milliseconds before the request is aborted. Default 30s. */
  timeoutMs?: number;
  /** Query params — merged into the URL, undefined/null values dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Internal — set true for auth endpoints themselves to prevent refresh-retry recursion. */
  skipAuthRetry?: boolean;
  /** Internal — marks a request as already having gone through one refresh-retry cycle. */
  _isRetry?: boolean;
}

/// Deliberately NOT `new URL(...)` — the `URL` constructor requires an absolute first
/// argument (or a second `base` argument) and throws on a bare relative string like `/api`,
/// which is exactly the value `apiBaseUrl()` legitimately returns for the F11A same-origin
/// proxy config. Plain string concatenation + `URLSearchParams` for the query string works
/// identically whether the base is absolute (`http://localhost:3000`) or relative (`/api`) —
/// `fetch()` itself accepts either form directly, resolving a relative URL against the
/// current page's own origin exactly like a normal `<a href>` would.
function buildUrl(path: string, query?: ApiFetchOptions["query"]): string {
  const base = `${apiBaseUrl()}${path}`;
  if (!query) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object" && "error" in json) {
      return json as ApiErrorBody;
    }
    return null;
  } catch {
    return null;
  }
}

async function rawRequest(path: string, options: ApiFetchOptions, body: BodyInit | undefined, extraHeaders: HeadersInit): Promise<Response> {
  const { query, timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...rest } = options;
  const token = getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // Respect a caller-supplied signal too (e.g. React Query's own cancellation) — abort on
  // whichever fires first.
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    return await fetch(buildUrl(path, query), {
      ...rest,
      // The httpOnly refresh_token cookie is forwarded automatically here — this client
      // never reads it (docs/security/AUTH_MODEL.md §3; lib/auth/token-store.ts).
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
        ...headers,
      },
      body,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/// Single-flight refresh coordination — the core fix for the "3 concurrent 401s each
/// trigger their own refresh" race (F02 instruction §7). Every caller (the 401-retry path
/// below, and `bootstrapSession()`'s own initial silent refresh) awaits the SAME in-flight
/// promise instead of starting a second `POST /auth/refresh` — the backend's refresh-token
/// ROTATION (docs/security/AUTH_MODEL.md §2: a presented refresh token is revoked and
/// replaced on every use) makes a concurrent second call actively harmful, not just wasteful:
/// it would race the first call's rotation and one of the two would fail with
/// `401 INVALID_REFRESH_TOKEN` against an already-rotated token.
let refreshPromise: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(): Promise<boolean> {
  try {
    const response = await rawRequest(
      "/auth/refresh",
      { method: "POST", skipAuthRetry: true },
      JSON.stringify({}),
      { "Content-Type": "application/json" },
    );
    if (!response.ok) {
      clearAccessToken();
      return false;
    }
    const json = (await response.json()) as { accessToken: string };
    setAccessToken(json.accessToken);
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, ...rest } = options;
  const isJsonBody = body !== undefined;
  const response = await rawRequest(
    path,
    rest,
    isJsonBody ? JSON.stringify(body) : undefined,
    isJsonBody ? { "Content-Type": "application/json" } : {},
  );

  if (response.status === 401 && !options.skipAuthRetry && !options._isRetry && !AUTH_ENDPOINTS_NO_RETRY.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
    notifySessionExpired();
    // Fall through to the normal error path below, so the original caller's error handling
    // (e.g. a React Query `onError`) still sees a real ApiError instead of hanging forever.
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    if (errorBody?.error) {
      throw new ApiError(response.status, errorBody);
    }
    throw new ApiError(response.status, {
      error: { code: "UNKNOWN_ERROR", message: response.statusText || "Request failed.", requestId: response.headers.get("x-request-id") ?? "" },
    });
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/// Resolves a backend-relative path (e.g. the `downloadUrl` returned by
/// `GET /documents/:id/download`) to an absolute URL for direct browser navigation — the one
/// case outside apiFetch/apiUpload/apiDownloadBlob that legitimately needs the base URL,
/// since redeeming a document download is a plain browser navigation (new tab), not a fetch
/// this app parses itself. Keeps `NEXT_PUBLIC_API_URL` read exclusively inside this module
/// (docs/frontend/FRONTEND_ARCHITECTURE.md §15).
export function resolveApiUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

/// Multipart file upload (`POST /documents`, `POST /documents/:id/versions` shape —
/// docs/api/API_CONVENTIONS.md §11 Phase 12 block). Deliberately a separate function from
/// `apiFetch`: FormData must NOT get a JSON `Content-Type` (the browser sets the multipart
/// boundary itself), and upload progress isn't meaningfully expressible through plain
/// `fetch` — a domain phase that needs a progress bar should extend this, not duplicate it.
export async function apiUpload<T>(path: string, formData: FormData, options: Omit<ApiFetchOptions, "body"> = {}): Promise<T> {
  const response = await rawRequest(path, { ...options, method: options.method ?? "POST" }, formData, {});

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiUpload<T>(path, formData, { ...options, skipAuthRetry: true });
    }
    notifySessionExpired();
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    if (errorBody?.error) throw new ApiError(response.status, errorBody);
    throw new ApiError(response.status, {
      error: { code: "UNKNOWN_ERROR", message: response.statusText || "Upload failed.", requestId: "" },
    });
  }
  return (await response.json()) as T;
}

/// Binary download (the second step of the signed-URL flow, `GET /documents/download/:token`
/// — docs/api/API_CONVENTIONS.md §11). That specific endpoint is `@Public()`/token-authorized
/// (the token IS the credential), so it works with or without an access token attached; this
/// helper still goes through the same base-URL/timeout machinery as everything else, just
/// returns a `Blob` instead of parsed JSON, since the response is a file, not the error/data
/// envelope.
export async function apiDownloadBlob(path: string, options: Omit<ApiFetchOptions, "body"> = {}): Promise<Blob> {
  const response = await rawRequest(path, options, undefined, {});
  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    if (errorBody?.error) throw new ApiError(response.status, errorBody);
    throw new ApiError(response.status, {
      error: { code: "UNKNOWN_ERROR", message: response.statusText || "Download failed.", requestId: "" },
    });
  }
  return response.blob();
}
