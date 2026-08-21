"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { StudentPicker } from "@/components/crm/student-picker";
import { useContractTemplates } from "@/lib/contracts/hooks";
import type { Contract, CreateContractInput, UpdateContractInput } from "@/lib/contracts/types";

/// Create/edit Contract. Create requires `studentId` (an existing Student — F04 instruction
/// §7: "Không tạo Student hoặc Case mới chỉ vì tạo Contract"). Edit is offered only while
/// DRAFT (caller-gated — `contract.status === "DRAFT"`); the backend independently rejects a
/// PATCH on any other status with `409 INVALID_CONTRACT_STATE`.
export function ContractFormDialog({
  open,
  onClose,
  contract,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  contract?: Contract;
  onSubmit: (input: CreateContractInput | UpdateContractInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!contract;
  const [studentId, setStudentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [servicePackage, setServicePackage] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: templates } = useContractTemplates(open && !isEdit);

  useResetOnOpen(open, () => {
    setStudentId(contract?.studentId ?? "");
    setTemplateId("");
    setServicePackage(contract?.servicePackage ?? "");
    setValue(contract?.value ?? "");
    setCurrency(contract?.currency ?? "VND");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      setError("Giá trị hợp đồng không hợp lệ.");
      return;
    }
    try {
      if (isEdit) {
        await onSubmit({ servicePackage: servicePackage || undefined, value: numericValue, currency } satisfies UpdateContractInput);
      } else {
        if (!studentId.trim()) {
          setError("Vui lòng chọn học sinh.");
          return;
        }
        await onSubmit({
          studentId: studentId.trim(),
          templateId: templateId || undefined,
          servicePackage: servicePackage || undefined,
          value: numericValue,
          currency,
        } satisfies CreateContractInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hợp đồng." : "Đã tạo hợp đồng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hợp đồng (bản nháp)" : "Tạo hợp đồng mới"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {!isEdit ? <StudentPicker value={studentId} onChange={setStudentId} label="Học sinh" /> : null}
        {!isEdit && templates && templates.length > 0 ? (
          <div>
            <label htmlFor="contract-template" className="mb-1 block text-sm font-medium">
              Mẫu hợp đồng (tùy chọn)
            </label>
            <select
              id="contract-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Không dùng mẫu —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="contract-service-package" className="mb-1 block text-sm font-medium">
            Gói dịch vụ
          </label>
          <Input id="contract-service-package" value={servicePackage} onChange={(e) => setServicePackage(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="contract-value" className="mb-1 block text-sm font-medium">
              Giá trị *
            </label>
            <Input id="contract-value" type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="contract-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ *
            </label>
            <Input id="contract-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
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
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo hợp đồng"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
