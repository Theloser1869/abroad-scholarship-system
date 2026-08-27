"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CommissionSourceType, CreateCommissionTransactionInput } from "@/lib/commission-transactions/types";

const SOURCE_TYPES: CommissionSourceType[] = ["Contract", "Payment", "Visa"];

/// Create a CommissionTransaction (F06 instruction §22) — `sourceId`/`commissionRuleId`/
/// `studentId`/`caseId`/`applicationId` are manual UUID inputs (the source Contract/Payment
/// and the target CommissionRule are typically already known from the finance workflow
/// context that led here; no cross-domain picker exists for these, same "manual UUID for a
/// narrow linkage field" precedent as F04/F05 evidence fields). `409
/// PARTNER_STUDENT_LINK_REQUIRED` — a real, non-obvious precondition — is surfaced verbatim,
/// never pre-checked client-side.
export function CommissionTransactionCreateDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCommissionTransactionInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [sourceType, setSourceType] = useState<CommissionSourceType>("Contract");
  const [sourceId, setSourceId] = useState("");
  const [partnerProgramId, setPartnerProgramId] = useState("");
  const [commissionRuleId, setCommissionRuleId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setSourceType("Contract");
    setSourceId("");
    setPartnerProgramId("");
    setCommissionRuleId("");
    setStudentId("");
    setCaseId("");
    setApplicationId("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        sourceType,
        sourceId: sourceId.trim(),
        partnerProgramId: partnerProgramId.trim() || undefined,
        commissionRuleId: commissionRuleId.trim() || undefined,
        studentId: studentId.trim() || undefined,
        caseId: caseId.trim() || undefined,
        applicationId: applicationId.trim() || undefined,
      });
      toast({ title: "Đã tạo giao dịch hoa hồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Tạo giao dịch hoa hồng">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="commission-transaction-source-type" className="mb-1 block text-sm font-medium">
              Loại nguồn *
            </label>
            <select
              id="commission-transaction-source-type"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as CommissionSourceType)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s === "Contract" ? "Hợp đồng" : s === "Payment" ? "Thanh toán" : "Visa"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="commission-transaction-source-id" className="mb-1 block text-sm font-medium">
              Source ID *
            </label>
            <Input id="commission-transaction-source-id" value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="UUID hợp đồng/thanh toán/visa" required />
          </div>
        </div>
        <div>
          <label htmlFor="commission-transaction-rule" className="mb-1 block text-sm font-medium">
            Commission Rule ID (tùy chọn — để trống để hệ thống tự chọn quy tắc phù hợp)
          </label>
          <Input id="commission-transaction-rule" value={commissionRuleId} onChange={(e) => setCommissionRuleId(e.target.value)} placeholder="UUID quy tắc hoa hồng" />
        </div>
        <div>
          <label htmlFor="commission-transaction-partner-program" className="mb-1 block text-sm font-medium">
            Partner Program ID (tùy chọn)
          </label>
          <Input id="commission-transaction-partner-program" value={partnerProgramId} onChange={(e) => setPartnerProgramId(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="commission-transaction-student" className="mb-1 block text-sm font-medium">
              Student ID
            </label>
            <Input id="commission-transaction-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Tự suy ra nếu để trống" />
          </div>
          <div>
            <label htmlFor="commission-transaction-case" className="mb-1 block text-sm font-medium">
              Case ID
            </label>
            <Input id="commission-transaction-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
          </div>
          <div>
            <label htmlFor="commission-transaction-application" className="mb-1 block text-sm font-medium">
              Application ID
            </label>
            <Input id="commission-transaction-application" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
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
            {submitting ? "Đang tạo..." : "Tạo giao dịch"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
