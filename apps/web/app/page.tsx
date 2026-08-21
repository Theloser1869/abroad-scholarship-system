import Link from "next/link";

// Public landing page. /dashboard and /portal both require auth (RequireAuth inside their
// respective layouts) — visiting either while signed out redirects to /login automatically.
export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Hệ thống Quản lý Du học &amp; Học bổng</h1>
      <p className="max-w-md text-muted-foreground">
        Nội bộ nhân viên và Cổng thông tin Học sinh/Phụ huynh. Xem{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-sm">docs/frontend/</code> để biết
        route map và kiến trúc.
      </p>
      <nav className="flex gap-4 text-sm">
        <Link className="text-primary underline underline-offset-4" href="/login">
          Đăng nhập
        </Link>
        <Link className="text-primary underline underline-offset-4" href="/dashboard">
          Staff workspace
        </Link>
        <Link className="text-primary underline underline-offset-4" href="/portal">
          Student/Parent portal
        </Link>
      </nav>
    </main>
  );
}
