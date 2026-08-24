"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateVisaInput, UpdateVisaInput, Visa } from "@/lib/visas/types";

/// Create/edit Visa (F06 instruction §6). `offerId` is a manual UUID input (optional) — no
/// case-scoped Offer picker exists yet (same "manual UUID for a narrow, optional linkage
/// field" precedent as F04/F05 evidence fields); the case's Applications/Offers can be
/// browsed from `/cases/[caseId]/applications` to find the right ID. `409 ACTIVE_VISA_EXISTS`
/// is surfaced verbatim via the shared `DuplicateConflictNotice` — at most one non-terminal
/// Visa per Case, decided entirely by the backend.
export function VisaFormDialog({
  open,
  onClose,
  visa,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  visa?: Visa;
  onSubmit: (input: CreateVisaInput | UpdateVisaInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!visa;
  const [countryCode, setCountryCode] = useState("");
  const [visaType, setVisaType] = useState("");
  const [offerId, setOfferId] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setCountryCode(visa?.countryCode ?? "");
    setVisaType(visa?.visaType ?? "");
    setOfferId(visa?.offerId ?? "");
    setInternalNotes(visa?.internalNotes ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({
          countryCode: countryCode.trim().toUpperCase(),
          visaType: visaType.trim(),
          offerId: offerId.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
        } satisfies UpdateVisaInput);
      } else {
        await onSubmit({
          countryCode: countryCode.trim().toUpperCase(),
          visaType: visaType.trim(),
          offerId: offerId.trim() || undefined,
        } satisfies CreateVisaInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hồ sơ visa." : "Đã tạo hồ sơ visa.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hồ sơ visa" : "Tạo hồ sơ visa mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="visa-country" className="mb-1 block text-sm font-medium">
              Mã quốc gia (ISO-2) *
            </label>
            <Input id="visa-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required />
          </div>
          <div>
            <label htmlFor="visa-type" className="mb-1 block text-sm font-medium">
              Loại visa *
            </label>
            <Input id="visa-type" value={visaType} onChange={(e) => setVisaType(e.target.value)} placeholder="Student, Work..." required />
          </div>
        </div>
        <div>
          <label htmlFor="visa-offer" className="mb-1 block text-sm font-medium">
            Offer ID (tùy chọn)
          </label>
          <Input id="visa-offer" value={offerId} onChange={(e) => setOfferId(e.target.value)} placeholder="UUID thư mời nhập học" />
        </div>
        {isEdit ? (
          <div>
            <label htmlFor="visa-internal-notes" className="mb-1 block text-sm font-medium">
              Ghi chú nội bộ
            </label>
            <Textarea
              id="visa-internal-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
            />
          </div>
        ) : null}
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingVisaId" hrefBuilder={(id) => `/visas/${id}`} linkLabel="Xem hồ sơ visa đang hoạt động →" /> : null}
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
