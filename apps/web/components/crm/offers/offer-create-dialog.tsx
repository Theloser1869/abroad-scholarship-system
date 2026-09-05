"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { CreateOfferInput } from "@/lib/offers/types";

/// Record a new Offer (F05 instruction §18/§20) — the backend requires the parent
/// Application to be SUBMITTED/WAITLIST/OFFER (`409 OFFER_REQUIRES_SUBMITTED_APPLICATION`
/// otherwise) and transitions it to OFFER status as a side effect; never pre-checked here.
/// A revised offer is always a NEW row — this dialog only ever creates, never edits an
/// existing Offer's terms (offer history is never overwritten).
export function OfferCreateDialog({
  open,
  onClose,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Owner for any evidence document uploaded inline through this dialog. */
  caseId: string;
  onSubmit: (input: CreateOfferInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [offerType, setOfferType] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [acceptanceDeadline, setAcceptanceDeadline] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("");
  const [isConditional, setIsConditional] = useState(false);
  const [conditions, setConditions] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setOfferType("");
    setOfferDate("");
    setAcceptanceDeadline("");
    setDepositAmount("");
    setDepositCurrency("");
    setIsConditional(false);
    setConditions("");
    setEvidenceDocumentId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        offerType: offerType.trim(),
        offerDate: offerDate || undefined,
        acceptanceDeadline: acceptanceDeadline || undefined,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        depositCurrency: depositCurrency.trim() || undefined,
        isConditional,
        conditions: conditions.trim() || undefined,
        evidenceDocumentId: evidenceDocumentId.trim() || undefined,
      });
      toast({ title: "Đã ghi nhận thư mời nhập học.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ghi nhận thư mời nhập học">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="offer-type" className="mb-1 block text-sm font-medium">
            Loại thư mời *
          </label>
          <Input id="offer-type" value={offerType} onChange={(e) => setOfferType(e.target.value)} placeholder="Unconditional, Conditional, Deferred..." required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="offer-date" className="mb-1 block text-sm font-medium">
              Ngày nhận thư
            </label>
            <Input id="offer-date" type="date" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="offer-acceptance-deadline" className="mb-1 block text-sm font-medium">
              Hạn phản hồi
            </label>
            <Input id="offer-acceptance-deadline" type="date" value={acceptanceDeadline} onChange={(e) => setAcceptanceDeadline(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="offer-deposit-amount" className="mb-1 block text-sm font-medium">
              Tiền đặt cọc
            </label>
            <Input id="offer-deposit-amount" type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="offer-deposit-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ
            </label>
            <Input id="offer-deposit-currency" value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isConditional} onChange={(e) => setIsConditional(e.target.checked)} />
          Thư mời có điều kiện
        </label>
        {isConditional ? (
          <div>
            <label htmlFor="offer-conditions" className="mb-1 block text-sm font-medium">
              Điều kiện
            </label>
            <Textarea
              id="offer-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
            />
          </div>
        ) : null}
        <DocumentAttachmentField
          label="Tệp thư mời"
          documentId={evidenceDocumentId}
          onChange={setEvidenceDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="OFFER_LETTER"
        />
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
            {submitting ? "Đang lưu..." : "Ghi nhận thư mời"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
