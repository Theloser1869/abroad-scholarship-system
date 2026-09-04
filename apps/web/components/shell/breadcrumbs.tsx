"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useBreadcrumbLabels } from "@/components/shell/breadcrumb-labels";

/// Derives labels from the URL path itself, except where a page has registered a friendlier
/// one via `useBreadcrumbLabel` (a case code instead of its UUID, a student's name instead of
/// theirs) — see `breadcrumb-labels.tsx`. A segment with no registered label falls back to the
/// raw path segment, so a route that hasn't opted in yet still renders something.
export function Breadcrumbs() {
  const pathname = usePathname();
  const { labels } = useBreadcrumbLabels();
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
          const label = labels[segment] ?? decodeURIComponent(segment).replace(/-/g, " ");
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
