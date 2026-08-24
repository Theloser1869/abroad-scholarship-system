"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateEnrollmentInput, UpdateEnrollmentInput } from "@/lib/enrollments/types";

/// Create Enrollment (F06 instruction §14) — `offerId` is a manual UUID input (required):
/// no case-scoped Offer picker exists yet, same "manual UUID for a narrow linkage field"
/// precedent as F04/F05 evidence fields; the case's Applications/Offers can be browsed from
/// `/cases/[caseId]/applications` to find the right (ACCEPTED) offer's ID. `university`/
/// `program` are derived server-side from the Offer — never client-supplied, structurally
/// impossible to "create new institution/program records" here. `409
/// INVALID_ENROLLMENT_TARGET` is surfaced verbatim, never pre-filtered by an invented
/// offer-validity rule (F06 instruction §16).
export function EnrollmentFormDialog({
  open,
  onClose,
  isEdit = false,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  isEdit?: boolean;
  onSubmit: (input: CreateEnrollmentInput | UpdateEnrollmentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [offerId, setOfferId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setOfferId("");
    setStartDate("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({ startDate: startDate || undefined, evidenceDocumentId: evidenceDocumentId.trim() || undefined } satisfies UpdateEnrollmentInput);
      } else {
        await onSubmit({ offerId: offerId.trim(), startDate: startDate || undefined, evidenceDocumentId: evidenceDocumentId.trim() || undefined } satisfies CreateEnrollmentInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hồ sơ nhập học." : "Đã tạo hồ sơ nhập học.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hồ sơ nhập học" : "Tạo hồ sơ nhập học"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {!isEdit ? (
          <div>
            <label htmlFor="enrollment-offer" className="mb-1 block text-sm font-medium">
              Offer ID *
            </label>
            <Input id="enrollment-offer" value={offerId} onChange={(e) => setOfferId(e.target.value)} placeholder="UUID thư mời đã được chấp nhận" required />
            <p className="mt-1 text-xs text-muted-foreground">Chỉ chấp nhận thư mời ở trạng thái Đã chấp nhận — xem trong Hồ sơ ứng tuyển của case này.</p>
          </div>
        ) : null}
        <div>
          <label htmlFor="enrollment-start-date" className="mb-1 block text-sm font-medium">
            Ngày bắt đầu
          </label>
          <Input id="enrollment-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="enrollment-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="enrollment-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo hồ sơ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
