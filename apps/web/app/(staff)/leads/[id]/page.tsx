"use client";

import { Suspense, use, useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useLead, useLeadTimeline, useUpdateLead, useUpdateLeadStatus, useAssignLeadOwner, useConvertLead, useAddLeadNote } from "@/lib/leads/hooks";
import { LeadFormDialog } from "@/components/crm/leads/lead-form-dialog";
import { LeadStatusDialog } from "@/components/crm/leads/lead-status-dialog";
import { LeadConvertDialog } from "@/components/crm/leads/lead-convert-dialog";
import { AssignOwnerDialog } from "@/components/crm/assign-owner-dialog";
import { StatusBadge, LEAD_STATUS_VARIANT, LEAD_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { TimelineView } from "@/components/crm/timeline-view";
import { NoteForm } from "@/components/crm/note-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

const TERMINAL_STATUSES = new Set(["CONVERTED", "LOST"]);

export function LeadDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: lead, isLoading, error, refetch } = useLead(id);
  useBreadcrumbLabel(id, lead?.leadCode);
  const { data: timeline, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useLeadTimeline(id);

  const updateLead = useUpdateLead(id);
  const updateStatus = useUpdateLeadStatus(id);
  const assignOwner = useAssignLeadOwner(id);
  const convertLead = useConvertLead(id);
  const addNote = useAddLeadNote(id);

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !lead) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isTerminal = TERMINAL_STATUSES.has(lead.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{lead.contactName}</h1>
          <p className="text-sm text-muted-foreground">{lead.leadCode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} variantMap={LEAD_STATUS_VARIANT} label={LEAD_STATUS_LABEL[lead.status]} />
          {can("leads", "edit") ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {can("leads", "assign") ? (
            <Button variant="secondary" onClick={() => setAssignOpen(true)}>
              Gán chủ sở hữu
            </Button>
          ) : null}
          {can("leads", "edit") && !isTerminal ? (
            <Button variant="secondary" onClick={() => setStatusOpen(true)}>
              Chuyển trạng thái
            </Button>
          ) : null}
          {can("leads", "convert") && !isTerminal ? <Button onClick={() => setConvertOpen(true)}>Chuyển đổi → Học sinh</Button> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin liên hệ</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phụ huynh</dt>
              <dd>{lead.parentName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">SĐT phụ huynh</dt>
              <dd>{lead.parentPhone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{lead.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">SĐT học sinh</dt>
              <dd>{lead.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chủ sở hữu</dt>
              <dd>{lead.owner.fullName}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quan tâm</CardTitle>
          </CardHeader>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quốc gia</dt>
              <dd>{lead.countryInterest ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngành</dt>
              <dd>{lead.majorInterest ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Kỳ nhập học</dt>
              <dd>{lead.intake ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nguồn / Chiến dịch</dt>
              <dd>
                {lead.source ?? "—"} / {lead.campaign ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hoạt động &amp; Ghi chú</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <NoteForm onSubmit={(input) => addNote.mutateAsync(input)} />
          <TimelineView entries={timeline} isLoading={timelineLoading} error={timelineError} onRetry={() => refetchTimeline()} />
        </div>
      </Card>

      <LeadFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
        onSubmit={(input) => updateLead.mutateAsync(input)}
        submitting={updateLead.isPending}
      />
      <LeadStatusDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        currentStatus={lead.status}
        onSubmit={(status) => updateStatus.mutateAsync(status)}
        submitting={updateStatus.isPending}
      />
      <AssignOwnerDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Gán chủ sở hữu lead"
        currentOwnerId={lead.ownerId}
        onSubmit={(userId) => assignOwner.mutateAsync(userId)}
        submitting={assignOwner.isPending}
      />
      <LeadConvertDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onSubmit={(input) => convertLead.mutateAsync(input)}
        submitting={convertLead.isPending}
      />
    </div>
  );
}

// A dedicated `<Suspense>` boundary around the `use(params)` read — without it, an unwrapped
// suspend at the page root leaves nothing rendered with no predictable retry point (matters
// both for real navigation and for component tests asserting on the resolved content).
export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <LeadDetailPageInner params={params} />
    </Suspense>
  );
}

function LeadDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="leads" action="view">
      <LeadDetailContent id={id} />
    </RequirePermission>
  );
}
