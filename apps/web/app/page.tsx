import Link from "next/link";

// Public landing page. /dashboard and /portal both require auth (RequireAuth inside their
// respective layouts) — visiting either while signed out redirects to /login automatically.
// Login itself already routes each account to the right side (staff → /dashboard, student/
// parent → /portal — see login-form.tsx's redirectAfter), so this page only needs one entry
// point, not a separate link per audience.
export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Hệ thống Quản lý Du học &amp; Học bổng</h1>
        <p className="max-w-md text-muted-foreground">
          Nền tảng quản lý và theo dõi hồ sơ du học, học bổng dành cho nhân viên tư vấn và học
          sinh/phụ huynh.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Đăng nhập
      </Link>
    </main>
  );
}
