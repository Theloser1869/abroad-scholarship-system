"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { usePartner, useUpdatePartner, useArchivePartner } from "@/lib/partners/hooks";
import { usePartnerPrograms, useCreatePartnerProgram } from "@/lib/partner-programs/hooks";
import { usePartnerDocuments, useCreatePartnerDocument } from "@/lib/partner-documents/hooks";
import { usePartnerStudentLinksForPartner, useCreatePartnerStudentLink } from "@/lib/partner-student-links/hooks";
import { useCommissionTransactionsForPartner, useCreateCommissionTransaction } from "@/lib/commission-transactions/hooks";
import { PartnerFormDialog } from "@/components/crm/partners/partner-form-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { PartnerProgramFormDialog } from "@/components/crm/partner-programs/partner-program-form-dialog";
import { PartnerProgramRow } from "@/components/crm/partner-programs/partner-program-row";
import { PartnerDocumentFormDialog } from "@/components/crm/partner-documents/partner-document-form-dialog";
import { PartnerDocumentRow } from "@/components/crm/partner-documents/partner-document-row";
import { PartnerStudentLinkFormDialog } from "@/components/crm/partner-student-links/partner-student-link-form-dialog";
import { PartnerStudentLinkRow } from "@/components/crm/partner-student-links/partner-student-link-row";
import { CommissionTransactionCreateDialog } from "@/components/crm/commission-transactions/commission-transaction-create-dialog";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL, COMMISSION_TRANSACTION_STATUS_VARIANT, COMMISSION_TRANSACTION_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { UpdatePartnerInput } from "@/lib/partners/types";

const PARTNER_TYPE_LABEL: Record<string, string> = {
  UNIVERSITY_REPRESENTATIVE: "Đại diện trường",
  AGENCY: "Đại lý",
  LANGUAGE_CENTER: "Trung tâm ngoại ngữ",
  OTHER: "Khác",
};

/// Partner workspace — F06 instruction §17 header + §18/§19/§20 sub-sections. PartnerProgram/
/// PartnerDocument/PartnerStudentLink have no standalone routes (F01 never mapped them —
/// only `/partners`, `/partners/[id]` and the separately-routed `/partners/[partnerId]/
/// commission-rules`), so all three live here as sections with Dialogs, same "no invented
/// route" precedent as F04's Payment/Milestone.
export function PartnerDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const { data: partner, isLoading, error, refetch } = usePartner(id);
  const { data: programs, isLoading: programsLoading, error: programsError } = usePartnerPrograms(id, { limit: 50 });
  const { data: documents, isLoading: documentsLoading, error: documentsError } = usePartnerDocuments(id, { limit: 50 });
  const { data: links, isLoading: linksLoading, error: linksError } = usePartnerStudentLinksForPartner(id, { limit: 50 });
  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useCommissionTransactionsForPartner(id, { limit: 50 });

  const updatePartner = useUpdatePartner(id);
  const archivePartner = useArchivePartner(id);
  const createProgram = useCreatePartnerProgram(id);
  const createDocument = useCreatePartnerDocument(id);
  const createLink = useCreatePartnerStudentLink(id);
  const createTransaction = useCreateCommissionTransaction(id);

  const [editOpen, setEditOpen] = useState(false);
  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [createTransactionOpen, setCreateTransactionOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !partner) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canEditMaster = can("partner", "edit");

  async function handleArchive() {
    try {
      await archivePartner.mutateAsync();
      toast({ title: "Đã lưu trữ đối tác.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{partner.name}</h1>
          <p className="text-sm text-muted-foreground">
            {partner.partnerCode} · {PARTNER_TYPE_LABEL[partner.type] ?? partner.type} · {partner.countryCode}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={partner.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[partner.status]} />
          {canEditMaster ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
          ) : null}
          {canEditMaster && partner.status === "ACTIVE" ? (
            <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archivePartner.isPending}>
              Lưu trữ
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin liên hệ</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Người liên hệ</dt>
            <dd>{partner.contactName ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{partner.contactEmail ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Điện thoại</dt>
            <dd>{partner.contactPhone ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Website</dt>
            <dd>
              {partner.website ? (
                <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {partner.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {/* `null` when field-redacted for DOCUMENT_SPECIALIST, or genuinely unset —
             rendered exactly as returned. */}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ghi chú nội bộ</dt>
            <dd>{partner.internalNotes ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {can("commission_rules", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Quy tắc hoa hồng</CardTitle>
          </CardHeader>
          <Link href={`/partners/${id}/commission-rules`} className="text-sm text-primary hover:underline">
            Xem quy tắc hoa hồng →
          </Link>
        </Card>
      ) : null}

      {can("partner_programs", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Chương trình đối tác</CardTitle>
            {can("partner_programs", "create") ? (
              <Button variant="secondary" onClick={() => setCreateProgramOpen(true)}>
                + Chương trình
              </Button>
            ) : null}
          </CardHeader>
          {programsLoading ? (
            <LoadingState rows={2} />
          ) : programsError ? (
            <QueryErrorState error={programsError} />
          ) : !programs || programs.data.length === 0 ? (
            <EmptyState title="Chưa có chương trình đối tác nào." />
          ) : (
            <ul className="space-y-2">
              {programs.data.map((p) => (
                <PartnerProgramRow key={p.id} program={p} canEdit={can("partner_programs", "edit")} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {can("partner_documents", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Tài liệu đối tác</CardTitle>
            {can("partner_documents", "create") ? (
              <Button variant="secondary" onClick={() => setCreateDocumentOpen(true)}>
                + Tài liệu
              </Button>
            ) : null}
          </CardHeader>
          {documentsLoading ? (
            <LoadingState rows={2} />
          ) : documentsError ? (
            <QueryErrorState error={documentsError} />
          ) : !documents || documents.data.length === 0 ? (
            <EmptyState title="Chưa có tài liệu đối tác nào." />
          ) : (
            <ul className="space-y-2">
              {documents.data.map((d) => (
                <PartnerDocumentRow key={d.id} document={d} canEdit={can("partner_documents", "edit")} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {can("partner_student_links", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Học sinh liên kết</CardTitle>
            {can("partner_student_links", "create") ? (
              <Button variant="secondary" onClick={() => setCreateLinkOpen(true)}>
                + Liên kết
              </Button>
            ) : null}
          </CardHeader>
          {linksLoading ? (
            <LoadingState rows={2} />
          ) : linksError ? (
            <QueryErrorState error={linksError} />
          ) : !links || links.data.length === 0 ? (
            <EmptyState title="Chưa có học sinh liên kết nào." />
          ) : (
            <ul className="space-y-2">
              {links.data.map((l) => (
                <PartnerStudentLinkRow key={l.id} link={l} canEdit={can("partner_student_links", "edit")} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {can("commission_transactions", "view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Giao dịch hoa hồng</CardTitle>
            {can("commission_transactions", "create") ? (
              <Button variant="secondary" onClick={() => setCreateTransactionOpen(true)}>
                + Giao dịch
              </Button>
            ) : null}
          </CardHeader>
          {transactionsLoading ? (
            <LoadingState rows={2} />
          ) : transactionsError ? (
            <QueryErrorState error={transactionsError} />
          ) : !transactions || transactions.data.length === 0 ? (
            <EmptyState title="Chưa có giao dịch hoa hồng nào." />
          ) : (
            <ul className="space-y-2 text-sm">
              {transactions.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <Link href={`/commission-transactions/${t.id}`} className="text-primary underline-offset-2 hover:underline">
                    {t.sourceType} — {t.sourceId?.slice(0, 8)}…
                  </Link>
                  <StatusBadge status={t.status} variantMap={COMMISSION_TRANSACTION_STATUS_VARIANT} label={COMMISSION_TRANSACTION_STATUS_LABEL[t.status]} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <PartnerFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        partner={partner}
        onSubmit={(input) => updatePartner.mutateAsync(input as UpdatePartnerInput)}
        submitting={updatePartner.isPending}
      />
      <PartnerProgramFormDialog
        open={createProgramOpen}
        onClose={() => setCreateProgramOpen(false)}
        onSubmit={(input) => createProgram.mutateAsync(input as Parameters<typeof createProgram.mutateAsync>[0])}
        submitting={createProgram.isPending}
      />
      <PartnerDocumentFormDialog
        open={createDocumentOpen}
        onClose={() => setCreateDocumentOpen(false)}
        onSubmit={(input) => createDocument.mutateAsync(input as Parameters<typeof createDocument.mutateAsync>[0])}
        submitting={createDocument.isPending}
      />
      <PartnerStudentLinkFormDialog
        open={createLinkOpen}
        onClose={() => setCreateLinkOpen(false)}
        onSubmit={(input) => createLink.mutateAsync(input)}
        submitting={createLink.isPending}
      />
      <CommissionTransactionCreateDialog
        open={createTransactionOpen}
        onClose={() => setCreateTransactionOpen(false)}
        onSubmit={(input) => createTransaction.mutateAsync(input)}
        submitting={createTransaction.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ đối tác"
        description={`${partner.name} sẽ chuyển sang trạng thái ngừng hoạt động.`}
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archivePartner.isPending}
      />
    </div>
  );
}

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PartnerDetailPageInner params={params} />
    </Suspense>
  );
}

function PartnerDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="partner" action="view">
      <PartnerDetailContent id={id} />
    </RequirePermission>
  );
}
