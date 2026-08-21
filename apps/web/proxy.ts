import { NextResponse } from "next/server";

/// Protected-route boundary (F01 scope — see docs/frontend/FRONTEND_ARCHITECTURE.md
/// "Protected route boundary"). Named `proxy.ts` per Next.js 16 (the `middleware.ts`
/// convention is deprecated in this version — verified against
/// node_modules/next/dist/docs/.../proxy.md). This is WHERE route-level auth gating will
/// live; it does not gate anything yet — F02 replaces the body with a real check (redirect
/// to a login route when no valid session cookie/token is present for a
/// `(staff)`/`(portal)` route). Backend authorization is unaffected either way: every API
/// call is re-checked server-side regardless of what this proxy does
/// (docs/architecture/TARGET_ARCHITECTURE.md §1 — "Backend luôn re-check authorization kể cả
/// khi client gọi thẳng API"), so this is a UX convenience (skip rendering a page the user
/// can't use), never the security boundary itself.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
