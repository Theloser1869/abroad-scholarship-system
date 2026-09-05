"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import type { CreateTestRecordInput, TestRecord, UpdateTestRecordInput } from "@/lib/profile-evidence/types";

/// One row per attempt — a new attempt is a new row, never overwritten (F04 instruction §24).
/// `testType`+`attemptNumber` identify the record and are edit-locked once created (matching
/// `UpdateTestRecordDto`'s server-side omission of both fields).
export function TestRecordDialog({
  open,
  onClose,
  record,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: TestRecord;
  /** Owner for any evidence document uploaded inline through this dialog. */
  caseId: string;
  onSubmit: (input: CreateTestRecordInput | UpdateTestRecordInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!record;
  const [testType, setTestType] = useState("");
  const [attemptNumber, setAttemptNumber] = useState("1");
  const [testDate, setTestDate] = useState("");
  const [score, setScore] = useState("");
  const [target, setTarget] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setTestType(record?.testType ?? "");
    setAttemptNumber(record ? String(record.attemptNumber) : "1");
    setTestDate(record?.testDate ? record.testDate.slice(0, 10) : "");
    setScore(record?.score ?? "");
    setTarget(record?.target ?? "");
    setEvidenceDocumentId(record?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({
          testDate: testDate || undefined,
          score: score ? Number(score) : undefined,
          target: target ? Number(target) : undefined,
          evidenceDocumentId: evidenceDocumentId || undefined,
        } satisfies UpdateTestRecordInput);
      } else {
        if (!testType.trim()) return;
        await onSubmit({
          testType: testType.trim(),
          attemptNumber: Number(attemptNumber),
          testDate: testDate || undefined,
          score: score ? Number(score) : undefined,
          target: target ? Number(target) : undefined,
          evidenceDocumentId: evidenceDocumentId || undefined,
        } satisfies CreateTestRecordInput);
      }
      toast({ title: "Đã lưu kết quả bài thi.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa kết quả bài thi" : "Thêm lượt thi mới"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="test-type" className="mb-1 block text-sm font-medium">
              Loại bài thi *
            </label>
            <Input id="test-type" value={testType} onChange={(e) => setTestType(e.target.value)} placeholder="IELTS, SAT, TOEFL..." required disabled={isEdit} />
          </div>
          <div>
            <label htmlFor="test-attempt" className="mb-1 block text-sm font-medium">
              Lần thi số *
            </label>
            <Input id="test-attempt" type="number" min="1" value={attemptNumber} onChange={(e) => setAttemptNumber(e.target.value)} required disabled={isEdit} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="test-date" className="mb-1 block text-sm font-medium">
              Ngày thi
            </label>
            <Input id="test-date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="test-score" className="mb-1 block text-sm font-medium">
              Điểm
            </label>
            <Input id="test-score" type="number" step="0.01" value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="test-target" className="mb-1 block text-sm font-medium">
            Mục tiêu
          </label>
          <Input id="test-target" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <DocumentAttachmentField
          documentId={evidenceDocumentId}
          onChange={setEvidenceDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="TEST_RECORD_EVIDENCE"
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
          <Button type="submit" disabled={submitting || (!isEdit && !testType.trim())}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
