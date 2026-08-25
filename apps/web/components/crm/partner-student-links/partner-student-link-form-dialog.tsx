"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { StudentPicker } from "@/components/crm/student-picker";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreatePartnerStudentLinkInput } from "@/lib/partner-student-links/types";

/// Create a PartnerStudentLink (F06 instruction §20) — a pure junction row, never inferred
/// from Student/Partner names. `caseId`/`applicationId`/`contractId`/`scholarshipApplicationId`
/// (the last two added for Client Acceptance Remediation GAP-006) are manual UUID inputs
/// (optional, narrowing scope) since no case/application/contract/scholarship picker scoped
/// to an arbitrary Student exists yet — same "manual UUID for a narrow, optional linkage
/// field" precedent as F04/F05 evidence fields. Editing is limited to
/// `linkType`/`effectiveDate`/`notes` only — identity fields are locked after creation
/// (propose a new link instead of re-pointing one).
export function PartnerStudentLinkFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePartnerStudentLinkInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [studentId, setStudentId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [contractId, setContractId] = useState("");
  const [scholarshipApplicationId, setScholarshipApplicationId] = useState("");
  const [linkType, setLinkType] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setStudentId("");
    setCaseId("");
    setApplicationId("");
    setContractId("");
    setScholarshipApplicationId("");
    setLinkType("");
    setEffectiveDate("");
    setNotes("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId.trim()) {
      setError(new Error("Vui lòng chọn học sinh."));
      return;
    }
    try {
      await onSubmit({
        studentId: studentId.trim(),
        caseId: caseId.trim() || undefined,
        applicationId: applicationId.trim() || undefined,
        contractId: contractId.trim() || undefined,
        scholarshipApplicationId: scholarshipApplicationId.trim() || undefined,
        linkType: linkType.trim(),
        effectiveDate: effectiveDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Đã tạo liên kết đối tác — học sinh.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Liên kết học sinh với đối tác">
      <form onSubmit={handleSubmit} className="space-y-3">
        <StudentPicker value={studentId} onChange={setStudentId} label="Học sinh *" />
        <div>
          <label htmlFor="partner-link-type" className="mb-1 block text-sm font-medium">
            Loại liên kết *
          </label>
          <Input id="partner-link-type" value={linkType} onChange={(e) => setLinkType(e.target.value)} placeholder="Referral, Agent, Sponsor..." required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-link-case" className="mb-1 block text-sm font-medium">
              Case ID (tùy chọn)
            </label>
            <Input id="partner-link-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="UUID case" />
          </div>
          <div>
            <label htmlFor="partner-link-application" className="mb-1 block text-sm font-medium">
              Application ID (tùy chọn)
            </label>
            <Input id="partner-link-application" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} placeholder="UUID hồ sơ ứng tuyển" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-link-contract" className="mb-1 block text-sm font-medium">
              Contract ID (tùy chọn)
            </label>
            <Input id="partner-link-contract" value={contractId} onChange={(e) => setContractId(e.target.value)} placeholder="UUID hợp đồng" />
          </div>
          <div>
            <label htmlFor="partner-link-scholarship" className="mb-1 block text-sm font-medium">
              Scholarship Application ID (tùy chọn)
            </label>
            <Input
              id="partner-link-scholarship"
              value={scholarshipApplicationId}
              onChange={(e) => setScholarshipApplicationId(e.target.value)}
              placeholder="UUID hồ sơ học bổng"
            />
          </div>
        </div>
        <div>
          <label htmlFor="partner-link-effective" className="mb-1 block text-sm font-medium">
            Ngày hiệu lực
          </label>
          <Input id="partner-link-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="partner-link-notes" className="mb-1 block text-sm font-medium">
            Ghi chú
          </label>
          <Textarea
            id="partner-link-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingLinkId" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Tạo liên kết"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
