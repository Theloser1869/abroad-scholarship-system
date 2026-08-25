"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { AcademicRecord, CreateAcademicRecordInput, UpdateAcademicRecordInput } from "@/lib/profile-evidence/types";

/// One row per (school, period) — a later period is always a NEW record, never a replacement
/// (F04 instruction §23). Editing an existing row is a correction to THAT period only.
export function AcademicRecordDialog({
  open,
  onClose,
  record,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: AcademicRecord;
  onSubmit: (input: CreateAcademicRecordInput | UpdateAcademicRecordInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [school, setSchool] = useState("");
  const [period, setPeriod] = useState("");
  const [grade, setGrade] = useState("");
  const [gpa, setGpa] = useState("");
  const [gradingScale, setGradingScale] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setSchool(record?.school ?? "");
    setPeriod(record?.period ?? "");
    setGrade(record?.grade ?? "");
    setGpa(record?.gpa ?? "");
    setGradingScale(record?.gradingScale ?? "");
    setEvidenceDocumentId(record?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!school.trim() || !period.trim()) return;
    setError(null);
    try {
      await onSubmit({
        school: school.trim(),
        period: period.trim(),
        grade: grade.trim() || undefined,
        gpa: gpa ? Number(gpa) : undefined,
        gradingScale: gradingScale || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
      });
      toast({ title: "Đã lưu hồ sơ học tập.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={record ? "Sửa hồ sơ học tập" : "Thêm hồ sơ học tập"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="academic-school" className="mb-1 block text-sm font-medium">
              Trường *
            </label>
            <Input id="academic-school" value={school} onChange={(e) => setSchool(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="academic-period" className="mb-1 block text-sm font-medium">
              Kỳ học *
            </label>
            <Input id="academic-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Grade 11, 2024–2025" required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="academic-grade" className="mb-1 block text-sm font-medium">
              Lớp
            </label>
            <Input id="academic-grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Lớp 11" />
          </div>
          <div>
            <label htmlFor="academic-gpa" className="mb-1 block text-sm font-medium">
              GPA
            </label>
            <Input id="academic-gpa" type="number" step="0.01" value={gpa} onChange={(e) => setGpa(e.target.value)} />
          </div>
          <div>
            <label htmlFor="academic-scale" className="mb-1 block text-sm font-medium">
              Thang điểm
            </label>
            <Input id="academic-scale" value={gradingScale} onChange={(e) => setGradingScale(e.target.value)} placeholder="4.0, 10, %..." />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Lớp và GPA cùng với hồ sơ học sinh cần điền đầy đủ trước khi duyệt đánh giá (Assessment).</p>
        <div>
          <label htmlFor="academic-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="academic-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
          <Button type="submit" disabled={submitting || !school.trim() || !period.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
