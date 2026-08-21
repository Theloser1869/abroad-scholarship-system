import Link from "next/link";

// Single root layout (no multiple-root-layouts / dynamic top-level segment), so plain
// not-found.tsx is sufficient — the experimental global-not-found.js convention is not
// needed here (see node_modules/next/dist/docs/.../not-found.md).
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Không tìm thấy trang.</h2>
      <p className="text-sm text-muted-foreground">Trang bạn tìm không tồn tại hoặc đã bị di chuyển.</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Về trang chủ
      </Link>
    </div>
  );
}
