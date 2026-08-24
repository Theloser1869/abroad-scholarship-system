import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// process.env.NEXT_PUBLIC_API_URL must be set before client.ts is imported, since
// apiBaseUrl() reads it eagerly on each call (not at module load time), so setting it in
// beforeEach is sufficient here.
process.env.NEXT_PUBLIC_API_URL = "https://api.test.local";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a successful response to parsed JSON", async () => {
    const { apiFetch } = await import("./client");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { hello: "world" }));

    const result = await apiFetch<{ hello: string }>("/ping");

    expect(result).toEqual({ hello: "world" });
    // Cookie-based credential forwarding is always on — this client never reads the
    // refresh_token cookie itself (docs/security/AUTH_MODEL.md §3).
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
  });

  it.each([
    [400, "BAD_REQUEST"],
    [403, "PERMISSION_DENIED"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "UNPROCESSABLE_ENTITY"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL_ERROR"],
  ])("maps a %i response into ApiError with code %s", async (status, code) => {
    const { apiFetch } = await import("./client");
    const { ApiError } = await import("./types");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(status, { error: { code, message: "boom", requestId: "req-1" } }),
    );

    const error = await apiFetch("/thing", { skipAuthRetry: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, requestId: "req-1" });
  });

  it("a 404 for a genuinely-missing record and a 404 for an out-of-scope record are structurally identical (non-enumeration)", async () => {
    // docs/security/RBAC_MATRIX.md §3 "why 404, not 403" — the client has no logic that
    // could distinguish these two cases even if it tried; this test proves that by
    // constructing both server responses identically and confirming the resulting ApiError
    // instances are indistinguishable in shape.
    const { apiFetch } = await import("./client");
    type ApiErrorInstance = import("./types").ApiError;
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "STUDENT_NOT_FOUND", message: "Student x not found.", requestId: "r1" } }))
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "STUDENT_NOT_FOUND", message: "Student y not found.", requestId: "r2" } }));

    const [missingErr, outOfScopeErr] = await Promise.all([
      apiFetch<never>("/students/missing-id", { skipAuthRetry: true }).catch((e: unknown) => e as ApiErrorInstance),
      apiFetch<never>("/students/out-of-scope-id", { skipAuthRetry: true }).catch((e: unknown) => e as ApiErrorInstance),
    ]);

    expect(missingErr.status).toBe(outOfScopeErr.status);
    expect(missingErr.code).toBe(outOfScopeErr.code);
    expect(Object.keys(missingErr)).toEqual(Object.keys(outOfScopeErr));
  });

  it("F11A: works with a relative same-origin base URL (NEXT_PUBLIC_API_URL=/api), including query params — never throws the way new URL() would on a bare relative string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "/api";
    const { apiFetch } = await import("./client");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { items: [] }));

    await apiFetch("/students", { query: { page: 2, search: "an" } });

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("/api/students?page=2&search=an");

    process.env.NEXT_PUBLIC_API_URL = "https://api.test.local";
  });

  it("POST /auth/refresh always sends an empty body — the refresh token is never read from a cookie and forwarded manually", async () => {
    // docs/security/AUTH_MODEL.md §3 / lib/auth/token-store.ts's file comment: the httpOnly
    // cookie is the ONLY transport for the refresh token; this client must never read
    // document.cookie and re-send its value itself.
    const { refreshSession } = await import("./client");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { accessToken: "t" }));

    await refreshSession();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe("{}");
    expect(String(init.body)).not.toMatch(/refresh/i);
  });
});

describe("apiFetch — single-flight refresh on 401", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("three concurrent 401s trigger exactly one POST /auth/refresh call", async () => {
    const { apiFetch } = await import("./client");
    const mockFetch = vi.mocked(fetch);

    // Every call to a protected endpoint 401s once, then succeeds on retry (post-refresh);
    // the refresh call itself succeeds once. Per-URL hit counter (local closure, not global
    // state) so each of the 3 concurrent endpoints gets exactly one retry.
    const hitsByUrl = new Map<string, number>();
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) {
        return jsonResponse(200, { accessToken: "new-token" });
      }
      const hits = (hitsByUrl.get(url) ?? 0) + 1;
      hitsByUrl.set(url, hits);
      if (hits === 1) {
        return jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "expired", requestId: "r" } });
      }
      return jsonResponse(200, { ok: true });
    });

    const results = await Promise.all([
      apiFetch("/a"),
      apiFetch("/b"),
      apiFetch("/c"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    const refreshCalls = mockFetch.mock.calls.filter(([input]) => String(input).includes("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("clears the access token and notifies session-expired when refresh fails", async () => {
    const { apiFetch } = await import("./client");
    const { getAccessToken, onSessionExpired, setAccessToken } = await import("../auth/token-store");
    setAccessToken("stale-token");
    const listener = vi.fn();
    onSessionExpired(listener);

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) {
        return jsonResponse(401, { error: { code: "INVALID_REFRESH_TOKEN", message: "invalid", requestId: "r" } });
      }
      return jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "expired", requestId: "r" } });
    });

    await expect(apiFetch("/protected")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();

    onSessionExpired(null);
  });

  it("does not attempt a refresh for the login endpoint itself (no recursive auth loop)", async () => {
    const { apiFetch } = await import("./client");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "bad", requestId: "r" } }),
    );

    await expect(
      apiFetch("/auth/login", { method: "POST", body: { username: "x", password: "y" }, skipAuthRetry: true }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce(); // no second (refresh) call attempted
  });
});
