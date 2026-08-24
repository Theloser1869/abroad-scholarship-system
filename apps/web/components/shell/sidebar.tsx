"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { STAFF_NAV } from "./nav-config";
import { cn } from "@/lib/utils/cn";

/// Permission-aware sidebar (F02 instruction §16): a group with zero visible items after
/// filtering renders nothing at all — a role never sees an empty "Thương mại" heading with
/// no links under it. An item the role CAN see but that has no real page yet renders
/// disabled with a "sắp có" hint, never a link to fake content (§15).
export function Sidebar() {
  const { can } = usePermissions();
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="hidden w-56 shrink-0 border-r border-border p-4 text-sm md:block">
      {STAFF_NAV.map((group) => {
        const visibleItems = group.items.filter((item) => !item.resource || can(item.resource, item.action!));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <ul>
              {visibleItems.map((item) => {
                const active = pathname === item.href;
                if (!item.implemented) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        className="flex items-center justify-between rounded px-2 py-1.5 text-muted-foreground opacity-60"
                      >
                        {item.label}
                        <span className="text-[10px]">sắp có</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded px-2 py-1.5 hover:bg-muted",
                        active && "bg-muted font-medium text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
