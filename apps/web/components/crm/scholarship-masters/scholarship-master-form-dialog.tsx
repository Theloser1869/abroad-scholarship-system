"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { UniversityPicker } from "@/components/crm/universities/university-picker";
import { ProgramPicker } from "@/components/crm/programs/program-picker";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateScholarshipMasterInput, ScholarshipMaster, UpdateScholarshipMasterInput } from "@/lib/scholarship-masters/types";

/// Create/edit ScholarshipMaster (F05 instruction §11) — kept structurally distinct from
/// ScholarshipApplication (the per-student transaction, `lib/scholarship-applications/`).
/// `universityId`/`programId` are both optional and independent (a scholarship may tie to a
/// specific Program, a University generally, or neither).
export function ScholarshipMasterFormDialog({
  open,
  onClose,
  scholarshipMaster,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  scholarshipMaster?: ScholarshipMaster;
  onSubmit: (input: CreateScholarshipMasterInput | UpdateScholarshipMasterInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!scholarshipMaster;
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [programId, setProgramId] = useState("");
  const [coverageType, setCoverageType] = useState("");
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [amountCurrency, setAmountCurrency] = useState("");
  const [deadline, setDeadline] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState("");
  const [conditions, setConditions] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();
  const router = useRouter();

  useResetOnOpen(open, () => {
    setProvider(scholarshipMaster?.provider ?? "");
    setName(scholarshipMaster?.name ?? "");
    setUniversityId(scholarshipMaster?.universityId ?? "");
    setProgramId(scholarshipMaster?.programId ?? "");
    setCoverageType(scholarshipMaster?.coverageType ?? "");
    setAmount(scholarshipMaster?.amount ?? "");
    setPercentage(scholarshipMaster?.percentage ?? "");
    setAmountCurrency(scholarshipMaster?.amountCurrency ?? "");
    setDeadline(scholarshipMaster?.deadline ? scholarshipMaster.deadline.slice(0, 10) : "");
    setEligibility(scholarshipMaster?.eligibility ?? "");
    setRequiredDocuments(scholarshipMaster?.requiredDocuments ?? "");
    setConditions(scholarshipMaster?.conditions ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = {
        provider: provider.trim(),
        name: name.trim(),
        universityId: universityId.trim() || undefined,
        programId: programId.trim() || undefined,
        coverageType: coverageType.trim() || undefined,
        amount: amount ? Number(amount) : undefined,
        percentage: percentage ? Number(percentage) : undefined,
        amountCurrency: amountCurrency.trim() || undefined,
        deadline: deadline || undefined,
        eligibility: eligibility.trim() || undefined,
        requiredDocuments: requiredDocuments.trim() || undefined,
        conditions: conditions.trim() || undefined,
      } satisfies CreateScholarshipMasterInput;
      const created = await onSubmit(input);
      toast({ title: isEdit ? "Đã cập nhật học bổng." : "Đã tạo học bổng.", variant: "success" });
      onClose();
      if (!isEdit && created && typeof created === "object" && "id" in created) {
        router.push(`/scholarship-masters/${(created as { id: string }).id}`);
      }
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa học bổng" : "Tạo học bổng mới"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="scholarship-master-provider" className="mb-1 block text-sm font-medium">
              Đơn vị cấp *
            </label>
            <Input id="scholarship-master-provider" value={provider} onChange={(e) => setProvider(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="scholarship-master-name" className="mb-1 block text-sm font-medium">
              Tên học bổng *
            </label>
            <Input id="scholarship-master-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        </div>
        <UniversityPicker value={universityId} onChange={setUniversityId} label="Trường đại học (tùy chọn)" />
        <ProgramPicker value={programId} onChange={setProgramId} label="Chương trình (tùy chọn)" />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="scholarship-master-amount" className="mb-1 block text-sm font-medium">
              Giá trị
            </label>
            <Input id="scholarship-master-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="scholarship-master-percentage" className="mb-1 block text-sm font-medium">
              Tỷ lệ (%)
            </label>
            <Input id="scholarship-master-percentage" type="number" min="0" max="100" step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
          </div>
          <div>
            <label htmlFor="scholarship-master-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ
            </label>
            <Input id="scholarship-master-currency" value={amountCurrency} onChange={(e) => setAmountCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="scholarship-master-coverage" className="mb-1 block text-sm font-medium">
              Loại chi trả
            </label>
            <Input id="scholarship-master-coverage" value={coverageType} onChange={(e) => setCoverageType(e.target.value)} placeholder="Full tuition, Partial..." />
          </div>
          <div>
            <label htmlFor="scholarship-master-deadline" className="mb-1 block text-sm font-medium">
              Hạn nộp
            </label>
            <Input id="scholarship-master-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="scholarship-master-eligibility" className="mb-1 block text-sm font-medium">
            Điều kiện đủ tư cách
          </label>
          <Textarea
            id="scholarship-master-eligibility"
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="scholarship-master-documents" className="mb-1 block text-sm font-medium">
            Hồ sơ yêu cầu
          </label>
          <Textarea
            id="scholarship-master-documents"
            value={requiredDocuments}
            onChange={(e) => setRequiredDocuments(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="scholarship-master-conditions" className="mb-1 block text-sm font-medium">
            Điều kiện đi kèm
          </label>
          <Textarea
            id="scholarship-master-conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={2}
          />
        </div>
        {error ? (
          <DuplicateConflictNotice
            error={error}
            existingIdField="existingScholarshipMasterId"
            hrefBuilder={(id) => `/scholarship-masters/${id}`}
            linkLabel="Xem học bổng đã tồn tại →"
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo học bổng"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
