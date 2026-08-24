"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { ProgramPicker } from "@/components/crm/programs/program-picker";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { Application, CreateApplicationInput, UpdateApplicationInput } from "@/lib/applications/types";

/// Create/edit Application (F05 instruction §13/§14). `programId` is picked at create time
/// only — immutable after creation (`UpdateApplicationDto` doesn't even accept it; a wrong
/// program means a new Application, not a re-pointed one, per the backend's own DTO
/// comment). `409 ACTIVE_APPLICATION_EXISTS` is surfaced verbatim, never pre-checked with a
/// separate lookup request first (F05 instruction §15).
export function ApplicationFormDialog({
  open,
  onClose,
  application,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  application?: Application;
  onSubmit: (input: CreateApplicationInput | UpdateApplicationInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!application;
  const [programId, setProgramId] = useState("");
  const [intendedIntake, setIntendedIntake] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setProgramId("");
    setIntendedIntake(application?.intendedIntake ?? "");
    setDeadline(application?.deadline ? application.deadline.slice(0, 10) : "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !programId.trim()) {
      setError(new Error("Vui lòng chọn chương trình."));
      return;
    }
    try {
      if (isEdit) {
        await onSubmit({ intendedIntake: intendedIntake.trim() || undefined, deadline: deadline || undefined } satisfies UpdateApplicationInput);
      } else {
        await onSubmit({ programId: programId.trim(), intendedIntake: intendedIntake.trim() || undefined, deadline: deadline || undefined } satisfies CreateApplicationInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hồ sơ ứng tuyển." : "Đã tạo hồ sơ ứng tuyển.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hồ sơ ứng tuyển" : "Tạo hồ sơ ứng tuyển mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {isEdit ? (
          <div>
            <p className="mb-1 text-sm font-medium">Chương trình</p>
            <p className="text-sm text-muted-foreground">
              {application.program.degreeLevel} · {application.program.major} — {application.program.university.officialName}
            </p>
          </div>
        ) : (
          <ProgramPicker value={programId} onChange={setProgramId} label="Chương trình *" />
        )}
        <div>
          <label htmlFor="application-intake" className="mb-1 block text-sm font-medium">
            Đợt tuyển sinh dự kiến
          </label>
          <Input id="application-intake" value={intendedIntake} onChange={(e) => setIntendedIntake(e.target.value)} placeholder="Fall 2027..." />
        </div>
        <div>
          <label htmlFor="application-deadline" className="mb-1 block text-sm font-medium">
            Hạn nộp
          </label>
          <Input id="application-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingApplicationId" hrefBuilder={(id) => `/applications/${id}`} linkLabel="Xem hồ sơ đang hoạt động →" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo hồ sơ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
