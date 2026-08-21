"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useStudents, useCreateStudent } from "@/lib/students/hooks";
import type { StudentListParams } from "@/lib/students/types";
import { StudentFormDialog } from "@/components/crm/students/student-form-dialog";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

function StudentsListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [targetCountry, setTargetCountry] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCountry = useDebouncedValue(targetCountry);

  const params: StudentListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedCountry ? { targetCountry: debouncedCountry } : {}),
  };

  const { data, isLoading, error, refetch } = useStudents(params);
  const createStudent = useCreateStudent();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Học sinh</h1>
        {can("students", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo học sinh</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Input
            placeholder="Tìm theo tên, mã học sinh..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Tìm kiếm học sinh"
          />
        </div>
        <div className="w-48">
          <Input
            placeholder="Lọc theo quốc gia"
            value={targetCountry}
            onChange={(e) => {
              setTargetCountry(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo quốc gia mục tiêu"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có học sinh nào." description="Thử điều chỉnh bộ lọc hoặc tạo học sinh mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã học sinh</TableHeaderCell>
                <TableHeaderCell>Họ tên</TableHeaderCell>
                <TableHeaderCell>Liên hệ</TableHeaderCell>
                <TableHeaderCell>Quốc gia mục tiêu</TableHeaderCell>
                <TableHeaderCell>Cập nhật</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Link href={`/students/${student.id}`} className="text-primary underline-offset-2 hover:underline">
                      {student.studentCode}
                    </Link>
                  </TableCell>
                  <TableCell>{student.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{student.email ?? student.phone ?? "—"}</TableCell>
                  <TableCell>{student.targetCountry ?? "—"}</TableCell>
                  <TableCell>{new Date(student.updatedAt).toLocaleDateString("vi-VN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <StudentFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createStudent.mutateAsync(input)}
        submitting={createStudent.isPending}
      />
    </div>
  );
}

export default function StudentsPage() {
  return (
    <RequirePermission resource="students" action="view">
      <StudentsListPage />
    </RequirePermission>
  );
}
