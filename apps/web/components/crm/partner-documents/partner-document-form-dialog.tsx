"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { PARTNER_DOCUMENT_TYPES, type CreatePartnerDocumentInput, type PartnerDocument, type PartnerDocumentType, type UpdatePartnerDocumentInput } from "@/lib/partner-documents/types";

const TYPE_LABEL: Record<PartnerDocumentType, string> = {
  MOU: "Biên bản ghi nhớ (MOU)",
  AGREEMENT: "Thỏa thuận",
  COMMISSION_AGREEMENT: "Thỏa thuận hoa hồng",
  RATE_SHEET: "Bảng giá",
  OTHER: "Khác",
};

/// Create/edit PartnerDocument — its own model wrapping an already-uploaded Document
/// (`documentId` required, F06 instruction §19/§32: never a direct upload here, reuses the
/// existing Document subsystem). Editable only while DRAFT — a signed/effective document is
/// replaced by creating a NEW version row, never edited in place.
export function PartnerDocumentFormDialog({
  open,
  onClose,
  document,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit (DRAFT only); absent = create. */
  document?: PartnerDocument;
  onSubmit: (input: CreatePartnerDocumentInput | UpdatePartnerDocumentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!document;
  const [type, setType] = useState<PartnerDocumentType>("MOU");
  const [documentId, setDocumentId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setType(document?.type ?? "MOU");
    setDocumentId(document?.documentId ?? "");
    setEffectiveDate(document?.effectiveDate ? document.effectiveDate.slice(0, 10) : "");
    setExpiryDate(document?.expiryDate ? document.expiryDate.slice(0, 10) : "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({
          documentId: documentId.trim() || undefined,
          effectiveDate: effectiveDate || undefined,
          expiryDate: expiryDate || undefined,
        } satisfies UpdatePartnerDocumentInput);
      } else {
        if (!documentId.trim()) {
          setError("Vui lòng nhập Document ID (tài liệu phải đã được tải lên trước).");
          return;
        }
        await onSubmit({
          type,
          documentId: documentId.trim(),
          effectiveDate: effectiveDate || undefined,
          expiryDate: expiryDate || undefined,
        } satisfies CreatePartnerDocumentInput);
      }
      toast({ title: isEdit ? "Đã cập nhật tài liệu." : "Đã tạo tài liệu đối tác.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa tài liệu đối tác (nháp)" : "Thêm tài liệu đối tác"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {isEdit ? (
          <p className="text-sm text-muted-foreground">
            Loại: {TYPE_LABEL[document.type]} · Phiên bản {document.version}
          </p>
        ) : (
          <div>
            <label htmlFor="partner-document-type" className="mb-1 block text-sm font-medium">
              Loại tài liệu *
            </label>
            <select
              id="partner-document-type"
              value={type}
              onChange={(e) => setType(e.target.value as PartnerDocumentType)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {PARTNER_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="partner-document-document-id" className="mb-1 block text-sm font-medium">
            Document ID {!isEdit ? "*" : ""}
          </label>
          <Input id="partner-document-document-id" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="UUID tài liệu đã tải lên" required={!isEdit} />
          <p className="mt-1 text-xs text-muted-foreground">Tài liệu phải đã được tải lên qua hệ thống tài liệu hiện có.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-document-effective" className="mb-1 block text-sm font-medium">
              Ngày hiệu lực
            </label>
            <Input id="partner-document-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="partner-document-expiry" className="mb-1 block text-sm font-medium">
              Ngày hết hạn
            </label>
            <Input id="partner-document-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
