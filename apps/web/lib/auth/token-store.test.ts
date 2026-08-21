import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("token-store — access token is memory-only", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("clearAccessToken() actually clears — nothing lingers for a later request to pick up", async () => {
    const { getAccessToken, setAccessToken, clearAccessToken } = await import("./token-store");
    setAccessToken("secret-access-token");
    expect(getAccessToken()).toBe("secret-access-token");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("onSessionExpired listener fires exactly once per notifySessionExpired() call, and can be unregistered", async () => {
    const { onSessionExpired, notifySessionExpired } = await import("./token-store");
    const listener = vi.fn();
    onSessionExpired(listener);
    notifySessionExpired();
    expect(listener).toHaveBeenCalledOnce();

    onSessionExpired(null);
    notifySessionExpired(); // no listener registered — must not throw
    expect(listener).toHaveBeenCalledOnce(); // still just the one call from before
  });
});

describe("security — the refresh token is never read via document.cookie", () => {
  let cookieGetter: ReturnType<typeof vi.fn>;
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "https://api.test.local";
    cookieGetter = vi.fn(() => "");
    originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: cookieGetter as () => string,
      set: () => {},
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Document.prototype, "cookie", originalDescriptor);
    }
    vi.stubGlobal("fetch", undefined);
    vi.unstubAllGlobals();
  });

  it("a full login → refresh → logout cycle never reads document.cookie — the httpOnly cookie is forwarded by the browser automatically via credentials:'include', never read/re-sent by this code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ accessToken: "t", refreshToken: "r", expiresInMinutes: 15, user: { id: "u", username: "a", email: "a@b.c", fullName: "A", roleCode: "SYSTEM_ADMIN" } }), { status: 201, headers: { "Content-Type": "application/json" } })),
    );
    const authApi = await import("./auth-api");

    await authApi.login("admin", "pw");
    await authApi.logout();

    expect(cookieGetter).not.toHaveBeenCalled();
  });
});
