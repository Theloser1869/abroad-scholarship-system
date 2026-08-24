"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePortalMe } from "@/lib/portal/hooks";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card } from "@/components/ui/card";

/// `GET /portal/me` resolves the caller's own accessible student(s) — never a client guess.
/// A single accessible student (the common case: a Student themselves, or a Parent with one
/// child) redirects straight to their Overview; more than one renders a picker card per
/// student (F08 instruction §10/§6: "one route tree, not two" — Student vs. Parent is not a
/// URL/page distinction, only how many cards a given caller happens to see here).
export default function PortalHomePage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = usePortalMe(true);

  const students = data?.students ?? [];
  const soleStudentId = students.length === 1 ? students[0].id : null;

  useEffect(() => {
    if (soleStudentId) router.replace(`/portal/students/${soleStudentId}`);
  }, [soleStudentId, router]);

  if (isLoading || soleStudentId) return <LoadingState />;
  if (error) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  if (students.length === 0) {
    return <EmptyState title="Chưa có học sinh nào được liên kết với tài khoản này." />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Chọn học sinh</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {students.map((s) => (
          <Link key={s.id} href={`/portal/students/${s.id}`}>
            <Card className="hover:border-primary">
              <p className="font-medium">{s.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {s.studentCode} {s.relationship !== "SELF" ? `· ${s.relationship}` : ""}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
