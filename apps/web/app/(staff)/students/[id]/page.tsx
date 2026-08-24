"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import {
  useStudent,
  useStudentTimeline,
  useStudentContacts,
  useCasesForStudent,
  useUpdateStudent,
  useArchiveStudent,
  useAddStudentNote,
  useCreateCaseForStudent,
  useCreateStudentContact,
  useInviteParent,
  useRevokeParentAccess,
} from "@/lib/students/hooks";
import { StudentFormDialog } from "@/components/crm/students/student-form-dialog";
import { StudentContactFormDialog } from "@/components/crm/students/student-contact-form-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { StatusBadge, CASE_STATUS_VARIANT, CASE_STATUS_LABEL, PORTAL_LINK_STATUS_VARIANT, PORTAL_LINK_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { TimelineView } from "@/components/crm/timeline-view";
import { NoteForm } from "@/components/crm/note-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { usePartnerStudentLinksForStudent } from "@/lib/partner-student-links/hooks";

export function StudentDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();
  const { data: student, isLoading, error, refetch } = useStudent(id);
  const { data: timeline, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useStudentTimeline(id);
  const { data: contacts, isLoading: contactsLoading, error: contactsError } = useStudentContacts(id);
  const { data: cases, isLoading: casesLoading, error: casesError } = useCasesForStudent(id);
  const canViewPartnerLinks = can("partner_student_links", "view");
  const { data: partnerLinks, isLoading: partnerLinksLoading, error: partnerLinksError } = usePartnerStudentLinksForStudent(canViewPartnerLinks ? id : "", { limit: 50 });

  const updateStudent = useUpdateStudent(id);
  const archiveStudent = useArchiveStudent(id);
  const addNote = useAddStudentNote(id);
  const createCase = useCreateCaseForStudent(id);
  const createContact = useCreateStudentContact(id);
  const inviteParent = useInviteParent(id);
  const revokeParentAccess = useRevokeParentAccess(id);

  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ contactId: string; name: string } | null>(null);

  if (isLoading) return <LoadingState />;
  if (error || !student) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  async function handleArchive() {
    try {
      await archiveStudent.mutateAsync();
      toast({ title: "Đã lưu trữ học sinh.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  async function handleCreateCase() {
    try {
      const created = await createCase.mutateAsync({});
      toast({ title: "Đã tạo case mới.", variant: "success" });
      router.push(`/cases/${created.id}`);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  /// F08 — the staff-side trigger for the Parent portal-access lifecycle. `devToken` (only
  /// ever returned outside production — no email-delivery integration exists yet) is shown
  /// once via toast so staff can relay the `/public/portal/invite/[token]` link out-of-band
  /// in this environment; never persisted beyond that toast.
  async function handleInviteParent(contactId: string) {
    try {
      const result = await inviteParent.mutateAsync(contactId);
      toast({
        title: "Đã gửi lời mời.",
        description: result.devToken ? `Link kích hoạt (chỉ hiện ngoài production): /public/portal/invite/${result.devToken}` : undefined,
        durationMs: result.devToken ? 0 : 5000,
      });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  async function handleRevokeParentAccess() {
    if (!revokeTarget) return;
    try {
      await revokeParentAccess.mutateAsync(revokeTarget.contactId);
      toast({ title: "Đã thu hồi quyền truy cập.", variant: "success" });
      setRevokeTarget(null);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{student.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {student.studentCode} {student.archivedAt ? "· Đã lưu trữ" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("students", "edit") ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {can("cases", "view") && can("cases", "edit") && !student.archivedAt ? (
            <Button variant="secondary" onClick={handleCreateCase} disabled={createCase.isPending}>
              {createCase.isPending ? "Đang tạo..." : "+ Case mới"}
            </Button>
          ) : null}
          {can("students", "archive") && !student.archivedAt ? (
            <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archiveStudent.isPending}>
              Lưu trữ
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày sinh</dt>
              <dd>{student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("vi-VN") : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{student.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Điện thoại</dt>
              <dd>{student.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quốc gia / Ngành mục tiêu</dt>
              <dd>
                {student.targetCountry ?? "—"} / {student.targetMajor ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngân sách</dt>
              {/* budget/budgetCurrency come back `null` when redacted for this role
                 (FieldPolicyService) — rendered exactly as returned, never a client
                 workaround (F03 instruction §10). */}
              <dd>{student.budget ? `${student.budget} ${student.budgetCurrency ?? ""}` : "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liên hệ</CardTitle>
            {can("students", "edit") ? (
              <Button variant="secondary" onClick={() => setContactOpen(true)}>
                + Thêm
              </Button>
            ) : null}
          </CardHeader>
          {contactsLoading ? (
            <LoadingState rows={2} />
          ) : contactsError ? (
            <QueryErrorState error={contactsError} />
          ) : !contacts || contacts.length === 0 ? (
            <EmptyState title="Chưa có liên hệ nào." />
          ) : (
            <ul className="space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="space-y-1 border-b border-border pb-2 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {c.name} <span className="font-normal text-muted-foreground">({c.relationship ?? c.type})</span>
                    </p>
                    <StatusBadge status={c.portalStatus} variantMap={PORTAL_LINK_STATUS_VARIANT} label={PORTAL_LINK_STATUS_LABEL[c.portalStatus]} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.phone ?? "—"} · {c.email ?? "—"}
                  </p>
                  {can("students", "edit") ? (
                    <div className="flex gap-2">
                      {(c.portalStatus === "NONE" || c.portalStatus === "REVOKED") && c.email ? (
                        <Button variant="secondary" onClick={() => handleInviteParent(c.id)} disabled={inviteParent.isPending}>
                          Mời vào cổng thông tin
                        </Button>
                      ) : null}
                      {c.portalStatus === "ACTIVE" ? (
                        <Button variant="danger" onClick={() => setRevokeTarget({ contactId: c.id, name: c.name })} disabled={revokeParentAccess.isPending}>
                          Thu hồi quyền truy cập
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case</CardTitle>
        </CardHeader>
        {casesLoading ? (
          <LoadingState rows={2} />
        ) : casesError ? (
          <QueryErrorState error={casesError} />
        ) : !cases || cases.data.length === 0 ? (
          <EmptyState title="Chưa có case nào." />
        ) : (
          <ul className="space-y-2 text-sm">
            {cases.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <Link href={`/cases/${c.id}`} className="text-primary underline-offset-2 hover:underline">
                  {c.caseCode}
                </Link>
                <StatusBadge status={c.status} variantMap={CASE_STATUS_VARIANT} label={CASE_STATUS_LABEL[c.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {can("university_choices", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Tuyển sinh</CardTitle>
          </CardHeader>
          <Link href={`/students/${id}/university-choices`} className="text-sm text-primary hover:underline">
            Lựa chọn trường (Reach/Match/Safety) →
          </Link>
        </Card>
      ) : null}

      {canViewPartnerLinks ? (
        <Card>
          <CardHeader>
            <CardTitle>Đối tác liên kết</CardTitle>
          </CardHeader>
          {partnerLinksLoading ? (
            <LoadingState rows={2} />
          ) : partnerLinksError ? (
            <QueryErrorState error={partnerLinksError} />
          ) : !partnerLinks || partnerLinks.data.length === 0 ? (
            <EmptyState title="Chưa có đối tác liên kết nào." />
          ) : (
            <ul className="space-y-2 text-sm">
              {partnerLinks.data.map((link) => (
                <li key={link.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <span className="font-medium">{link.partner.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {link.linkType} · {link.partner.countryCode}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{link.status === "ACTIVE" ? "Đang hoạt động" : "Đã lưu trữ"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Hoạt động &amp; Ghi chú</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <NoteForm onSubmit={(input) => addNote.mutateAsync(input)} />
          <TimelineView entries={timeline} isLoading={timelineLoading} error={timelineError} onRetry={() => refetchTimeline()} />
        </div>
      </Card>

      <StudentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        student={student}
        onSubmit={(input) => updateStudent.mutateAsync(input)}
        submitting={updateStudent.isPending}
      />
      <StudentContactFormDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onSubmit={(input) => createContact.mutateAsync(input)}
        submitting={createContact.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ học sinh"
        description="Thao tác này ẩn học sinh khỏi các danh sách hoạt động."
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archiveStudent.isPending}
      />
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Thu hồi quyền truy cập cổng thông tin"
        description={revokeTarget ? `${revokeTarget.name} sẽ mất quyền truy cập cổng thông tin ngay lập tức.` : undefined}
        confirmLabel="Thu hồi"
        variant="danger"
        onConfirm={handleRevokeParentAccess}
        submitting={revokeParentAccess.isPending}
      />
    </div>
  );
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentDetailPageInner params={params} />
    </Suspense>
  );
}

function StudentDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="students" action="view">
      <StudentDetailContent id={id} />
    </RequirePermission>
  );
}
