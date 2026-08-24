"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { ProgramPicker } from "@/components/crm/programs/program-picker";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreatePartnerProgramInput, PartnerProgram, UpdatePartnerProgramInput } from "@/lib/partner-programs/types";

/// Create/edit PartnerProgram (F06 instruction §18) — `programId` is an OPTIONAL link to a
/// real core Program (F05's `ProgramPicker` reused directly), never a duplicated University/
/// Program row. No standalone detail route exists (F01 never mapped `/partner-programs/[id]`)
/// — this Dialog is launched from the Partner detail page's Programs section.
export function PartnerProgramFormDialog({
  open,
  onClose,
  program,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  program?: PartnerProgram;
  onSubmit: (input: CreatePartnerProgramInput | UpdatePartnerProgramInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!program;
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [major, setMajor] = useState("");
  const [intake, setIntake] = useState("");
  const [tuition, setTuition] = useState("");
  const [tuitionCurrency, setTuitionCurrency] = useState("");
  const [scholarshipInfo, setScholarshipInfo] = useState("");
  const [admissionsRule, setAdmissionsRule] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setName(program?.name ?? "");
    setProgramId(program?.programId ?? "");
    setDegreeLevel(program?.degreeLevel ?? "");
    setMajor(program?.major ?? "");
    setIntake(program?.intake ?? "");
    setTuition(program?.tuition ?? "");
    setTuitionCurrency(program?.tuitionCurrency ?? "");
    setScholarshipInfo(program?.scholarshipInfo ?? "");
    setAdmissionsRule(program?.admissionsRule ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        programId: programId.trim() || undefined,
        degreeLevel: degreeLevel.trim() || undefined,
        major: major.trim() || undefined,
        intake: intake.trim() || undefined,
        tuition: tuition ? Number(tuition) : undefined,
        tuitionCurrency: tuitionCurrency.trim() || undefined,
        scholarshipInfo: scholarshipInfo.trim() || undefined,
        admissionsRule: admissionsRule.trim() || undefined,
      } satisfies CreatePartnerProgramInput);
      toast({ title: isEdit ? "Đã cập nhật chương trình đối tác." : "Đã tạo chương trình đối tác.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa chương trình đối tác" : "Tạo chương trình đối tác"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="partner-program-name" className="mb-1 block text-sm font-medium">
            Tên chương trình *
          </label>
          <Input id="partner-program-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <ProgramPicker value={programId} onChange={setProgramId} label="Liên kết chương trình trong danh mục (tùy chọn)" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-program-degree" className="mb-1 block text-sm font-medium">
              Bậc học
            </label>
            <Input id="partner-program-degree" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} />
          </div>
          <div>
            <label htmlFor="partner-program-major" className="mb-1 block text-sm font-medium">
              Ngành
            </label>
            <Input id="partner-program-major" value={major} onChange={(e) => setMajor(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="partner-program-intake" className="mb-1 block text-sm font-medium">
            Đợt tuyển sinh
          </label>
          <Input id="partner-program-intake" value={intake} onChange={(e) => setIntake(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-program-tuition" className="mb-1 block text-sm font-medium">
              Học phí
            </label>
            <Input id="partner-program-tuition" type="number" min="0" step="0.01" value={tuition} onChange={(e) => setTuition(e.target.value)} />
          </div>
          <div>
            <label htmlFor="partner-program-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ
            </label>
            <Input id="partner-program-currency" value={tuitionCurrency} onChange={(e) => setTuitionCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          </div>
        </div>
        <div>
          <label htmlFor="partner-program-scholarship" className="mb-1 block text-sm font-medium">
            Thông tin học bổng
          </label>
          <Textarea
            id="partner-program-scholarship"
            value={scholarshipInfo}
            onChange={(e) => setScholarshipInfo(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="partner-program-admissions-rule" className="mb-1 block text-sm font-medium">
            Điều kiện tuyển sinh
          </label>
          <Textarea
            id="partner-program-admissions-rule"
            value={admissionsRule}
            onChange={(e) => setAdmissionsRule(e.target.value)}
            rows={2}
          />
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingPartnerProgramId" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
