// Placeholder landing route for the staff shell (F01 scaffold only — see
// docs/frontend/FRONTEND_ROUTES.md "Dashboard"). Real content (per-role summary,
// GET /reports/executive|manager|me) is F03+ domain work.
export default function StaffDashboardPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Scaffold placeholder — nội dung thật (executive/manager/my dashboard) thuộc phase domain
        sau F02.
      </p>
    </div>
  );
}
