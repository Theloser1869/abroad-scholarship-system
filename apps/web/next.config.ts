import type { NextConfig } from "next";

/// F11A — same-origin API proxy. `API_PROXY_TARGET` is deliberately NOT `NEXT_PUBLIC_*`
/// (never inlined into the client bundle, never visible to the browser or `apps/web`'s own
/// runtime code) — it is read only here, inside `next.config.ts`, which executes in Node.js
/// at Next.js's own request-routing layer, never shipped as JS to the browser. This is the
/// real backend origin the `/api/*` rewrite below proxies to; `NEXT_PUBLIC_API_URL` (the
/// client-visible variable `lib/api/client.ts` reads) is set to the *relative* path `/api` in
/// this same configuration, so the browser only ever talks to its own origin — see
/// docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md "Same-origin API proxy" for the full design.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET;

/// F11 production readiness — client-env validation + security headers. Runs at config-
/// evaluation time, which for `next build`/`next start` is real production evaluation (the
/// Next.js CLI sets `NODE_ENV=production` for `next build` regardless of the invoking shell's
/// value — verified against `node_modules/next/dist/cli/next-build.js`'s own debug-mode
/// warning, which only fires when NODE_ENV is *not* production). A misconfigured
/// `NEXT_PUBLIC_API_URL` is baked into the client bundle at this same build step (Next.js
/// inlines `NEXT_PUBLIC_*` vars at build time, not read at runtime) — failing loudly here,
/// rather than shipping a build that silently can't reach any backend, is the whole point
/// (docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md "Configure environment variables").
///
/// `NODE_ENV=production` alone is NOT enough signal to hard-fail on a localhost/http URL —
/// this project's own established workflow runs `next build`/`next start` locally in
/// production MODE against a local backend for QA (F09/F10, `NEXT_PUBLIC_API_URL=http://
/// localhost:3000`), and `next build` always sets `NODE_ENV=production` regardless. A second,
/// genuinely remote-deployment-only signal is needed: every major host sets its own
/// recognizable env var automatically (no manual config) — `VERCEL`, `CF_PAGES` (Cloudflare
/// Pages), `RENDER`, `NETLIFY`. Only when one of those is actually present do we know this
/// build targets a real remote environment, not a local prod-mode test run.
const REMOTE_PLATFORM_ENV_VARS = ["VERCEL", "CF_PAGES", "RENDER", "NETLIFY"];

function validateClientEnv(): void {
  const url = process.env.NEXT_PUBLIC_API_URL;
  const isProductionBuild = process.env.NODE_ENV === "production";
  const isRemotePlatformBuild = REMOTE_PLATFORM_ENV_VARS.some((key) => Boolean(process.env[key]));

  if (!url) {
    if (isProductionBuild) {
      // Always a hard failure regardless of local-QA-vs-real-deploy — an empty API URL makes
      // every single API call fail immediately (apiBaseUrl() in lib/api/client.ts), so there
      // is no legitimate production-mode build that should ever ship without one.
      throw new Error(
        "NEXT_PUBLIC_API_URL is not set. A production build requires a backend origin — " +
          "set it (in .env.local for a local production-mode run, or in the deployment " +
          "platform's environment variables for a real deploy; never commit it). See " +
          "docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md.",
      );
    }
    // Local dev (`next dev`) without a .env.local: apps/web/lib/api/client.ts's
    // apiBaseUrl() already throws a clear error the first time any API call is actually
    // made — nothing further to enforce at config-eval time here (the dev server must still
    // be able to start and show that error interactively, not die at config load).
    return;
  }

  // F11A same-origin proxy: a relative NEXT_PUBLIC_API_URL (e.g. "/api") is now a legitimate,
  // *preferred* production value — see the API_PROXY_TARGET comment above. It is not a URL on
  // its own (no scheme/host), so it must be checked separately from the `new URL(url)` parse
  // below, which only applies to an absolute-origin value (local dev, or a same-origin
  // proxy-less deployment).
  if (url.startsWith("/")) {
    if (isProductionBuild && !API_PROXY_TARGET) {
      throw new Error(
        `NEXT_PUBLIC_API_URL is the relative same-origin path "${url}" but API_PROXY_TARGET ` +
          "is not set — nothing would actually proxy /api/* requests to a real backend, so " +
          "every API call would 404 against this app's own server. Set API_PROXY_TARGET to " +
          "the real backend origin (never NEXT_PUBLIC_-prefixed — it must stay server-only). " +
          "See docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md \"Same-origin API proxy\".",
      );
    }
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL is not a valid URL: "${url}".`);
  }

  if (!isProductionBuild) return;

  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const isNonHttps = parsed.protocol !== "https:";
  if (!isLocalHost && !isNonHttps) return;

  const problem = isLocalHost
    ? `points at ${parsed.hostname}, unreachable from any browser but the machine that built it`
    : `uses "${parsed.protocol}" instead of https:`;
  const message =
    `NEXT_PUBLIC_API_URL ("${url}") ${problem}. This is expected for a local production-mode ` +
    "QA run against a local backend, but would be a real misconfiguration in an actual remote " +
    "deployment. See docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md.";

  if (isRemotePlatformBuild) {
    // A recognized hosting platform's own env var is present — this is a genuine remote
    // deployment build, not a local prod-mode test. Fail loudly rather than ship it.
    throw new Error(message);
  }
  console.warn(`[next.config.ts] ${message}`);
}

/// Validates API_PROXY_TARGET independently of NEXT_PUBLIC_API_URL — a malformed proxy
/// target would silently break every `/api/*` request once deployed (the rewrite would just
/// never match/apply correctly), the same class of "fail loudly at build time, not silently
/// in production" reasoning validateClientEnv() already applies to the client-visible var.
function validateApiProxyTarget(): void {
  if (!API_PROXY_TARGET) return;
  let parsed: URL;
  try {
    parsed = new URL(API_PROXY_TARGET);
  } catch {
    throw new Error(`API_PROXY_TARGET is not a valid absolute URL: "${API_PROXY_TARGET}".`);
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    // Same warn-not-throw-unless-a-real-platform-is-detected posture as the client URL check
    // above — a local production-mode QA run may legitimately proxy to a plain-http local
    // backend (docs/frontend/FRONTEND_DEPLOYMENT_RUNBOOK.md's own established local-QA
    // pattern), but a genuine remote deployment proxying to a non-HTTPS backend is a real
    // misconfiguration worth failing loudly on.
    const isRemotePlatformBuild = REMOTE_PLATFORM_ENV_VARS.some((key) => Boolean(process.env[key]));
    const message = `API_PROXY_TARGET ("${API_PROXY_TARGET}") uses "${parsed.protocol}" instead of https: — expected for a local production-mode QA proxy to a local backend, but a real misconfiguration in an actual remote deployment.`;
    if (isRemotePlatformBuild) {
      throw new Error(message);
    }
    console.warn(`[next.config.ts] ${message}`);
  }
}

validateClientEnv();
validateApiProxyTarget();

/// Security headers (F11 §11/§12). Scoped to this app's *actual* resource usage, verified by
/// reading the source, not assumed:
/// - No `next/image` remote domains anywhere in the app (grepped) → `img-src` needs only
///   `'self'` (+`data:` for any inline SVG data URI, harmless to allow).
/// - Fonts are `next/font/google` (Geist/Geist Mono, `app/layout.tsx`), which self-hosts at
///   build time — the browser never fetches fonts.googleapis.com/fonts.gstatic.com at runtime,
///   so `font-src` needs only `'self'`.
/// - `script-src`/`style-src` keep `'unsafe-inline'` — Next.js injects its own inline
///   hydration bootstrap script and (for the CSS pipeline in use here) inline style tags
///   without a nonce by default; a nonce-based stricter policy is a real future tightening
///   (F11 "KNOWN ISSUES") but was not adopted here since it cannot be verified against a real
///   deployed instance in this phase (F11 explicitly forbids deploying) and a wrong nonce
///   wiring would silently break hydration for every page, which is a worse outcome than the
///   current, honestly-documented `'unsafe-inline'`.
/// - `connect-src` includes the real API origin (from `NEXT_PUBLIC_API_URL`) — every fetch
///   this app makes (`lib/api/client.ts`) targets exactly that origin, nothing else.
/// - `frame-ancestors 'none'` (this app is never meant to be iframed — no legitimate embedder)
///   duals as the CSP-native replacement for `X-Frame-Options: DENY`, kept alongside it for
///   older-browser coverage.
function buildCsp(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  let apiOrigin = "";
  // A relative value (F11A same-origin proxy, e.g. "/api") has no separate origin to add —
  // 'self' below already covers it, since the browser's request target IS this app's own
  // origin. `new URL()` would throw on a bare relative string, so skip the parse entirely
  // rather than routing it through the catch below (which is for a genuinely malformed
  // absolute-looking value, a distinct case).
  if (apiUrl && !apiUrl.startsWith("/")) {
    try {
      apiOrigin = new URL(apiUrl).origin;
    } catch {
      // Already rejected by validateClientEnv() above for a production build; for a
      // non-production build with a malformed value, just omit it from connect-src rather
      // than crash header generation.
    }
  }
  const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  /// F11A same-origin API proxy (instruction §4). Only active when `API_PROXY_TARGET` is
  /// actually set — local dev (which calls `http://localhost:3000` directly via
  /// `NEXT_PUBLIC_API_URL`, unchanged since F02) never sets it, so this returns no rewrites
  /// at all there and local architecture stays fully independent of this mechanism, per
  /// instruction §12. Next.js's own external-rewrite support (verified against
  /// node_modules/next/dist/docs/.../rewrites.md "Rewriting to an external URL") transparently
  /// proxies the full request — method, headers (including `Cookie`/`Authorization`), body
  /// (including multipart uploads), and query string — and the full response — status,
  /// headers (including `Set-Cookie`), and body (including a binary/streamed download) —
  /// with no additional wiring needed; this is a routing-layer proxy, not a hand-written
  /// route handler that would have to reimplement any of that. Verified live this phase
  /// (`docs/frontend/phase-status/PHASE_F11A.md`), not merely assumed from the docs.
  async rewrites() {
    if (!API_PROXY_TARGET) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET.replace(/\/+$/, "")}/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // HSTS only matters over an actual HTTPS response — harmless to always send (a
          // plain-HTTP local dev response simply has no opportunity to honor it), and most
          // deployment platforms (Vercel, Cloudflare Pages) terminate TLS in front of this
          // app the same way the backend documents for itself (docs/production/
          // SECURITY_BASELINE.md "HTTPS/TLS — deployment responsibility, not application-
          // level"). `preload` is deliberately omitted — that requires submission to browsers'
          // hard-coded preload list, a one-way decision this phase does not make.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
