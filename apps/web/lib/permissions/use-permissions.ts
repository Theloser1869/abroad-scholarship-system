"use client";

import { useMemo } from "react";
import { useAuth } from "../auth/auth-context";
import type { RoleCode } from "../auth/session";
import { ROLE_GRANTS, type Action, type Resource } from "./rbac-data";

/// Centralized capability check (F02 instruction §10) — NEVER `if (role === "SYSTEM_ADMIN")`
/// scattered through components. Pure function (no hook) so it's usable outside React too
/// (e.g. a route-config filter, §16 "Navigation phải phụ thuộc capability").
export function can(roleCode: RoleCode | null | undefined, resource: Resource, action: Action): boolean {
  if (!roleCode) return false;
  return ROLE_GRANTS[roleCode]?.[resource]?.includes(action) ?? false;
}

export function canAny(roleCode: RoleCode | null | undefined, resource: Resource, actions: Action[]): boolean {
  return actions.some((action) => can(roleCode, resource, action));
}

export function canAll(roleCode: RoleCode | null | undefined, resource: Resource, actions: Action[]): boolean {
  return actions.every((action) => can(roleCode, resource, action));
}

/// React hook form, bound to the current session's role — the version most components
/// actually use. Reminder (F02 instruction §10/§12): this only ever decides what renders.
/// The backend independently re-checks every one of these on the real request; a stale or
/// wrong result here degrades to "hid a button that would have worked" or "showed a button
/// that gets a 403", never to an actual unauthorized action succeeding.
export function usePermissions() {
  const { principal } = useAuth();
  const roleCode = principal?.roleCode ?? null;

  return useMemo(
    () => ({
      roleCode,
      can: (resource: Resource, action: Action) => can(roleCode, resource, action),
      canAny: (resource: Resource, actions: Action[]) => canAny(roleCode, resource, actions),
      canAll: (resource: Resource, actions: Action[]) => canAll(roleCode, resource, actions),
    }),
    [roleCode],
  );
}
