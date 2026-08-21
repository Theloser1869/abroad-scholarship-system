// Global fallback shown while a route segment's data is loading (React Suspense boundary
// Next.js inserts automatically around the segment). Domain routes may add their own
// nested loading.tsx for a more specific skeleton later; this is the catch-all.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Đang tải...
    </div>
  );
}
