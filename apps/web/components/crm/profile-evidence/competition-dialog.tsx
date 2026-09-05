"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { Competition, CreateCompetitionInput, UpdateCompetitionInput } from "@/lib/profile-evidence/types";

/// Each participation is its own row (F04 instruction §25) — never folded into Activity.
export function CompetitionDialog({
  open,
  onClose,
  record,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: Competition;
  /** Owner for any evidence document uploaded inline through this dialog. */
  caseId: string;
  onSubmit: (input: CreateCompetitionInput | UpdateCompetitionInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [eventName, setEventName] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState("");
  const [rank, setRank] = useState("");
  const [award, setAward] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setEventName(record?.eventName ?? "");
    setYear(record?.year ? String(record.year) : "");
    setCategory(record?.category ?? "");
    setResult(record?.result ?? "");
    setRank(record?.rank ?? "");
    setAward(record?.award ?? "");
    setEvidenceDocumentId(record?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventName.trim()) return;
    setError(null);
    try {
      await onSubmit({
        eventName: eventName.trim(),
        year: year ? Number(year) : undefined,
        category: category || undefined,
        result: result || undefined,
        rank: rank || undefined,
        award: award || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
      });
      toast({ title: "Đã lưu hoạt động thi đấu.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={record ? "Sửa hoạt động thi đấu" : "Thêm hoạt động thi đấu"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="competition-event" className="mb-1 block text-sm font-medium">
            Tên cuộc thi *
          </label>
          <Input id="competition-event" value={eventName} onChange={(e) => setEventName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="competition-year" className="mb-1 block text-sm font-medium">
              Năm
            </label>
            <Input id="competition-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <label htmlFor="competition-category" className="mb-1 block text-sm font-medium">
              Danh mục
            </label>
            <Input id="competition-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="competition-rank" className="mb-1 block text-sm font-medium">
              Thứ hạng
            </label>
            <Input id="competition-rank" value={rank} onChange={(e) => setRank(e.target.value)} />
          </div>
          <div>
            <label htmlFor="competition-award" className="mb-1 block text-sm font-medium">
              Giải thưởng
            </label>
            <Input id="competition-award" value={award} onChange={(e) => setAward(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="competition-result" className="mb-1 block text-sm font-medium">
            Kết quả
          </label>
          <Input id="competition-result" value={result} onChange={(e) => setResult(e.target.value)} />
        </div>
        <DocumentAttachmentField
          documentId={evidenceDocumentId}
          onChange={setEvidenceDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="COMPETITION_EVIDENCE"
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
          <Button type="submit" disabled={submitting || !eventName.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
