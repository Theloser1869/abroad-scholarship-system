/// Public shell — no `RequireAuth`, no sidebar/topbar. Login (and later password-reset/MFA-
/// enrollment-adjacent public pages) live in this route group.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-muted p-4">
      {children}
    </div>
  );
}
