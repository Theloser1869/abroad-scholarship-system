/// Public, unauthenticated shell — no `RequireAuth`, no staff/portal chrome. Mirrors
/// `(auth)/layout.tsx`'s centered-card style exactly (F08's parent-invite acceptance page is
/// the first resident; F04's deferred `/public/contracts/review/[token]` would live here too
/// if a future phase builds it — docs/frontend/FRONTEND_ROUTES.md's "public token-authorized
/// links" note).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 items-center justify-center bg-muted p-4">{children}</div>;
}
