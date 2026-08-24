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
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateProgramInput, Program, UpdateProgramInput } from "@/lib/programs/types";

/// Create/edit Program (F05 instruction §9/§10). University is picked at create time only
/// (via `UniversityPicker`) — on edit it's shown read-only (the embedded `program.university`
/// summary from DEC-11), same "identity-establishing field locked on edit" precedent as
/// Contract's `studentId`. Never duplicates University data as a separate local entity —
/// `universityId` is the only thing ever submitted.
export function ProgramFormDialog({
  open,
  onClose,
  program,
  fixedUniversityId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  program?: Program;
  /** Pre-fills + locks university when creating from a University's own detail page. */
  fixedUniversityId?: string;
  onSubmit: (input: CreateProgramInput | UpdateProgramInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!program;
  const [universityId, setUniversityId] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [major, setMajor] = useState("");
  const [intake, setIntake] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [tuition, setTuition] = useState("");
  const [tuitionCurrency, setTuitionCurrency] = useState("");
  const [applicationFee, setApplicationFee] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [requirements, setRequirements] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();
  const router = useRouter();

  useResetOnOpen(open, () => {
    setUniversityId(fixedUniversityId ?? "");
    setDegreeLevel(program?.degreeLevel ?? "");
    setMajor(program?.major ?? "");
    setIntake(program?.intake ?? "");
    setDurationMonths(program?.durationMonths != null ? String(program.durationMonths) : "");
    setTuition(program?.tuition ?? "");
    setTuitionCurrency(program?.tuitionCurrency ?? "");
    setApplicationFee(program?.applicationFee ?? "");
    setEligibility(program?.eligibility ?? "");
    setRequirements(program?.requirements ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !universityId.trim()) {
      setError(new Error("Vui lòng chọn trường đại học."));
      return;
    }
    try {
      const input = {
        ...(isEdit ? {} : { universityId: universityId.trim() }),
        degreeLevel: degreeLevel.trim(),
        major: major.trim(),
        intake: intake.trim() || undefined,
        durationMonths: durationMonths ? Number(durationMonths) : undefined,
        tuition: tuition ? Number(tuition) : undefined,
        tuitionCurrency: tuitionCurrency.trim() || undefined,
        applicationFee: applicationFee ? Number(applicationFee) : undefined,
        eligibility: eligibility.trim() || undefined,
        requirements: requirements.trim() || undefined,
      } as CreateProgramInput | UpdateProgramInput;
      const created = await onSubmit(input);
      toast({ title: isEdit ? "Đã cập nhật chương trình." : "Đã tạo chương trình.", variant: "success" });
      onClose();
      if (!isEdit && created && typeof created === "object" && "id" in created) {
        router.push(`/programs/${(created as { id: string }).id}`);
      }
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa chương trình" : "Tạo chương trình mới"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {isEdit ? (
          <div>
            <p className="mb-1 text-sm font-medium">Trường đại học</p>
            <p className="text-sm text-muted-foreground">
              {program.university.officialName} ({program.university.countryCode})
            </p>
          </div>
        ) : (
          <UniversityPicker value={universityId} onChange={setUniversityId} label="Trường đại học *" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="program-degree-level" className="mb-1 block text-sm font-medium">
              Bậc học *
            </label>
            <Input id="program-degree-level" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} placeholder="Bachelor, Master..." required />
          </div>
          <div>
            <label htmlFor="program-intake" className="mb-1 block text-sm font-medium">
              Đợt tuyển sinh
            </label>
            <Input id="program-intake" value={intake} onChange={(e) => setIntake(e.target.value)} placeholder="Fall 2027..." />
          </div>
        </div>
        <div>
          <label htmlFor="program-major" className="mb-1 block text-sm font-medium">
            Ngành *
          </label>
          <Input id="program-major" value={major} onChange={(e) => setMajor(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="program-duration" className="mb-1 block text-sm font-medium">
              Thời lượng (tháng)
            </label>
            <Input id="program-duration" type="number" min="1" step="1" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
          </div>
          <div>
            <label htmlFor="program-tuition-currency" className="mb-1 block text-sm font-medium">
              Tiền tệ học phí
            </label>
            <Input id="program-tuition-currency" value={tuitionCurrency} onChange={(e) => setTuitionCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="program-tuition" className="mb-1 block text-sm font-medium">
              Học phí
            </label>
            <Input id="program-tuition" type="number" min="0" step="0.01" value={tuition} onChange={(e) => setTuition(e.target.value)} />
          </div>
          <div>
            <label htmlFor="program-application-fee" className="mb-1 block text-sm font-medium">
              Lệ phí ứng tuyển
            </label>
            <Input id="program-application-fee" type="number" min="0" step="0.01" value={applicationFee} onChange={(e) => setApplicationFee(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Cùng loại tiền tệ với học phí.</p>
          </div>
        </div>
        <div>
          <label htmlFor="program-eligibility" className="mb-1 block text-sm font-medium">
            Điều kiện đủ tư cách
          </label>
          <Textarea
            id="program-eligibility"
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="program-requirements" className="mb-1 block text-sm font-medium">
            Yêu cầu hồ sơ
          </label>
          <Textarea
            id="program-requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
          />
        </div>
        {error ? (
          <DuplicateConflictNotice error={error} existingIdField="existingProgramId" hrefBuilder={(id) => `/programs/${id}`} linkLabel="Xem chương trình đã tồn tại →" />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo chương trình"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
