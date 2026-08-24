"use client";

import { usePortalProfile } from "@/lib/portal/hooks";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { PortalNav } from "./portal-nav";
import { StudentSwitcher } from "./student-switcher";

/// Shared shell for every `/portal/students/[id]/...` page. `studentId` is a route param —
/// NEVER trusted as authorized on its own (F08 instruction §33: "Do not assume route
/// parameter is authorized"). `usePortalProfile` is the one call every sub-page needs anyway
/// (the header), and it doubles as this shell's own authorization probe: if the backend 404s
/// (out-of-scope studentId, revoked parent, ...), `QueryErrorState` renders the exact generic
/// non-enumerating message and none of `children` (which would otherwise fire their own
/// requests against the same unauthorized studentId) ever mounts.
export function PortalStudentShell({ studentId, children }: { studentId: string; children: React.ReactNode }) {
  const { data: profile, isLoading, error, refetch } = usePortalProfile(studentId);

  if (isLoading) return <LoadingState />;
  if (error || !profile) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{profile.studentCode}</p>
          <h1 className="text-lg font-semibold">{profile.fullName}</h1>
        </div>
        <StudentSwitcher currentStudentId={studentId} />
      </div>
      <PortalNav studentId={studentId} />
      {children}
    </div>
  );
}
