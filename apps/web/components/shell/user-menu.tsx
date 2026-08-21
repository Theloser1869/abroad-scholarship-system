"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { roleLabel } from "@/lib/auth/role-label";

/// Header user menu (F02 instruction §17): display name + role + logout. System Admin gets
/// no special-cased extra menu items here — `usePermissions()`/the nav config are what
/// decide what SYSTEM_ADMIN can reach (Admin section only), never a hard-coded "if admin,
/// show everything" branch in this component (§17: "System Admin không tự động có toàn
/// quyền frontend").
export function UserMenu() {
  const { displayUser, principal, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!principal) return null;

  // See docs/frontend/FRONTEND_AUTH.md "Known backend gap" — displayUser is only populated
  // right after an in-tab login, not after a silent-refresh session restore. Fall back to
  // the role label alone rather than show nothing or a blank name.
  const name = displayUser?.fullName ?? roleLabel(principal.roleCode);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
      >
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">({roleLabel(principal.roleCode)})</span>
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Tài khoản"
          className="absolute right-0 z-10 mt-1 w-48 rounded border border-border bg-background py-1 shadow-md"
        >
          <li role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Đăng xuất
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
