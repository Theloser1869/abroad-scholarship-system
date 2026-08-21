"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

/// Foundation-only breadcrumbs — derives labels from the URL path itself (no page-title
/// registry exists yet). A domain phase with dynamic segments (`/students/[id]`) that wants
/// a real entity name in the trail (e.g. the student's name instead of their UUID) should
/// extend this with an explicit title override, not by this component guessing from data it
/// doesn't have.
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/dashboard" className="hover:text-foreground">
            Trang chủ
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;
          const label = decodeURIComponent(segment).replace(/-/g, " ");
          return (
            <Fragment key={href}>
              <li aria-hidden="true">/</li>
              <li>
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {label}
                  </span>
                ) : (
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
