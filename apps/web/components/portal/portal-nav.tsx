"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/// Mobile-first horizontal scrolling tab strip (F08 instruction §34: "cards over wide
/// tables... simple navigation... touch targets") — every item is a real F01-mapped Portal
/// route (docs/frontend/FRONTEND_ROUTES.md "PORTAL"), never invented. `aria-current="page"`
/// marks the active tab for screen readers (F08 instruction §35).
export function PortalNav({ studentId }: { studentId: string }) {
  const pathname = usePathname();
  const base = `/portal/students/${studentId}`;
  const items = [
    { href: base, label: "Tổng quan" },
    { href: `${base}/roadmap`, label: "Lộ trình" },
    { href: `${base}/tasks`, label: "Nhiệm vụ" },
    { href: `${base}/documents`, label: "Tài liệu" },
    { href: `${base}/applications`, label: "Hồ sơ ứng tuyển" },
    { href: `${base}/scholarships`, label: "Học bổng" },
    { href: `${base}/visa`, label: "Visa" },
    { href: `${base}/pre-departure`, label: "Trước khi đi" },
    { href: `${base}/enrollment`, label: "Nhập học" },
    { href: `${base}/contracts`, label: "Hợp đồng" },
    { href: `${base}/closure`, label: "Đóng hồ sơ" },
    { href: `${base}/notifications`, label: "Thông báo" },
  ];

  return (
    <nav aria-label="Điều hướng cổng thông tin" className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 whitespace-nowrap pb-2">
        {items.map((item) => {
          const active = item.href === base ? pathname === base : pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block rounded-full px-3 py-2 text-sm",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
