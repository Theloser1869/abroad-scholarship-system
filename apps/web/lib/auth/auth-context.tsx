"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as authApi from "./auth-api";
import { onSessionExpired } from "./token-store";
import { isMfaRequired, type LoginUser, type Principal } from "./session";

/// Auth state boundary (F02 — see docs/frontend/FRONTEND_AUTH.md "Auth state machine").
/// Five explicit states (F02 instruction §8) — never a bare `user === null` standing in for
/// both "still loading" and "definitely not logged in", which is indistinguishable and leads
/// to a flash of the wrong UI on every page load.
export type AuthStatus = "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "REFRESHING" | "ERROR";

export interface LoginOutcome {
  mfaRequired: boolean;
  mfaToken?: string;
  /** Set only when mfaRequired is false — lets the caller redirect by role synchronously
   *  without waiting for a re-render to observe the new context value. */
  principal?: Principal;
}

interface AuthContextValue {
  status: AuthStatus;
  /** Canonical session identity (userId/roleCode/sessionId) — always present when AUTHENTICATED. */
  principal: Principal | null;
  /**
   * Richer profile (username/email/fullName) — ONLY populated immediately after an actual
   * `login()`/`mfaVerify()` call in this tab, per docs/frontend/FRONTEND_AUTH.md "Known
   * backend gap": GET /auth/me (used on silent-refresh restore) does not return this. A
   * component showing a header display name must handle `displayUser === null` gracefully
   * (fall back to role label) rather than assume it's always available.
   */
  displayUser: LoginUser | null;
  error: Error | null;
  login: (username: string, password: string) => Promise<LoginOutcome>;
  mfaVerify: (mfaToken: string, code: string) => Promise<Principal>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("INITIALIZING");
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [displayUser, setDisplayUser] = useState<LoginUser | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  // Guards against setting state after unmount (StrictMode double-invoke / fast navigation
  // away from the page mid-bootstrap) — a plain boolean ref, not AbortController, since the
  // underlying refreshSession()/fetchMe() calls have no meaningful "cancel" semantics of
  // their own (single-flight refresh must run to completion regardless).
  const mountedRef = useRef(true);

  // Session bootstrap (F02 instruction §6). No access token survives a reload (in-memory
  // only, see token-store.ts) — so bootstrap always attempts a silent refresh FIRST (cookie-
  // driven), then resolves the principal from GET /auth/me only if that succeeded. A failed
  // refresh here is the ordinary "anonymous visitor" case (UNAUTHENTICATED), never an error;
  // only a genuinely unexpected failure (network/5xx on either call) becomes ERROR.
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const refreshed = await authApi.refreshSession();
        if (!mountedRef.current) return;
        if (!refreshed) {
          setStatus("UNAUTHENTICATED");
          return;
        }
        const me = await authApi.fetchMe();
        if (!mountedRef.current) return;
        setPrincipal(me);
        setStatus("AUTHENTICATED");
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error("Session bootstrap failed."));
        setStatus("ERROR");
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A refresh that fails somewhere deep in a 401-retry (lib/api/client.ts, any component's
  // API call) reaches here — the one place that knows how to tear down + redirect, so
  // `lib/api/` itself never needs to import React/routing.
  useEffect(() => {
    onSessionExpired(() => {
      setPrincipal(null);
      setDisplayUser(null);
      setStatus("UNAUTHENTICATED");
      queryClient.clear();
      router.push("/login");
    });
    return () => onSessionExpired(null);
  }, [queryClient, router]);

  const login = useCallback(async (username: string, password: string): Promise<LoginOutcome> => {
    setStatus("REFRESHING");
    setError(null);
    try {
      const response = await authApi.login(username, password);
      if (isMfaRequired(response)) {
        // Password was correct but a second factor is still required — not yet
        // authenticated. Revert to UNAUTHENTICATED (not ERROR) so the login form can render
        // the MFA challenge step.
        setStatus("UNAUTHENTICATED");
        return { mfaRequired: true, mfaToken: response.mfaToken };
      }
      const me = await authApi.fetchMe();
      setPrincipal(me);
      setDisplayUser(response.user);
      setStatus("AUTHENTICATED");
      return { mfaRequired: false, principal: me };
    } catch (err) {
      setStatus("UNAUTHENTICATED");
      throw err; // the login form owns rendering the specific error (INVALID_CREDENTIALS/ACCOUNT_LOCKED/...).
    }
  }, []);

  const mfaVerify = useCallback(async (mfaToken: string, code: string): Promise<Principal> => {
    setStatus("REFRESHING");
    setError(null);
    try {
      const response = await authApi.mfaLoginVerify(mfaToken, code);
      if (isMfaRequired(response)) {
        // Should not happen (verify either succeeds or throws) — defensive, not a real path.
        throw new Error("MFA verification unexpectedly required a second MFA step.");
      }
      const me = await authApi.fetchMe();
      setPrincipal(me);
      setDisplayUser(response.user);
      setStatus("AUTHENTICATED");
      return me;
    } catch (err) {
      setStatus("UNAUTHENTICATED");
      throw err;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await authApi.logout();
    setPrincipal(null);
    setDisplayUser(null);
    setStatus("UNAUTHENTICATED");
    queryClient.clear();
    router.push("/login");
  }, [queryClient, router]);

  return (
    <AuthContext
      value={{ status, principal, displayUser, error, login, mfaVerify, logout }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within <AuthProvider>.");
  }
  return ctx;
}
