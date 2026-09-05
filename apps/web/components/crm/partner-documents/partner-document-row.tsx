"use client";

import { useState } from "react";
import { useUpdatePartnerDocument, useActivatePartnerDocument, useArchivePartnerDocument } from "@/lib/partner-documents/hooks";
import { PartnerDocumentFormDialog } from "@/components/crm/partner-documents/partner-document-form-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, PARTNER_DOCUMENT_STATUS_VARIANT, PARTNER_DOCUMENT_STATUS_LABEL } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { PartnerDocument, PartnerDocumentType } from "@/lib/partner-documents/types";

const TYPE_LABEL: Record<PartnerDocumentType, string> = {
  MOU: "Biên bản ghi nhớ (MOU)",
  AGREEMENT: "Thỏa thuận",
  COMMISSION_AGREEMENT: "Thỏa thuận hoa hồng",
  RATE_SHEET: "Bảng giá",
  OTHER: "Khác",
};

/// Per-row component — same Rules-of-Hooks fix pattern as `PartnerProgramRow`. Editable
/// only while DRAFT (F06 instruction §19 — immutable once ACTIVE); activate/archive are
/// dedicated actions, never a bare status PATCH.
export function PartnerDocumentRow({ document, canEdit }: { document: PartnerDocument; canEdit: boolean }) {
  const { toast } = useToast();
  const updateDocument = useUpdatePartnerDocument(document.id);
  const activateDocument = useActivatePartnerDocument(document.id);
  const archiveDocument = useArchivePartnerDocument(document.id);
  const [editOpen, setEditOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function handleActivate() {
    try {
      await activateDocument.mutateAsync();
      toast({ title: "Đã kích hoạt tài liệu.", variant: "success" });
      setActivateOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  async function handleArchive() {
    try {
      await archiveDocument.mutateAsync();
      toast({ title: "Đã lưu trữ tài liệu.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="space-y-1 border-b border-border pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {TYPE_LABEL[document.type]} · Phiên bản {document.version}
        </span>
        <StatusBadge status={document.status} variantMap={PARTNER_DOCUMENT_STATUS_VARIANT} label={PARTNER_DOCUMENT_STATUS_LABEL[document.status]} />
      </div>
      <p className="text-xs text-muted-foreground">
        {document.effectiveDate ? `Hiệu lực từ ${new Date(document.effectiveDate).toLocaleDateString("vi-VN")}` : ""}
        {document.expiryDate ? ` · Hết hạn ${new Date(document.expiryDate).toLocaleDateString("vi-VN")}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceDocumentLink documentId={document.documentId} />
        {canEdit && document.status === "DRAFT" ? (
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
            <Button variant="primary" onClick={() => setActivateOpen(true)} disabled={activateDocument.isPending}>
              Kích hoạt
            </Button>
          </>
        ) : null}
        {canEdit && document.status !== "ARCHIVED" ? (
          <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archiveDocument.isPending}>
            Lưu trữ
          </Button>
        ) : null}
      </div>
      <PartnerDocumentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        document={document}
        partnerId={document.partnerId}
        onSubmit={(input) => updateDocument.mutateAsync(input)}
        submitting={updateDocument.isPending}
      />
      <ConfirmDialog
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        title="Kích hoạt tài liệu"
        description="Phiên bản hiệu lực trước đó (nếu có) sẽ tự động chuyển sang trạng thái Đã thay thế."
        confirmLabel="Kích hoạt"
        onConfirm={handleActivate}
        submitting={activateDocument.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ tài liệu"
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archiveDocument.isPending}
      />
    </li>
  );
}
