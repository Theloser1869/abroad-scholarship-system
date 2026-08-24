"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { ProgramPicker } from "@/components/crm/programs/program-picker";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateUniversityChoiceInput, UniversityChoice, UniversityChoiceTier, UpdateUniversityChoiceInput } from "@/lib/university-choices/types";

const TIERS: UniversityChoiceTier[] = ["REACH", "MATCH", "SAFETY"];
const TIER_LABEL: Record<UniversityChoiceTier, string> = { REACH: "Vượt tầm (Reach)", MATCH: "Phù hợp (Match)", SAFETY: "An toàn (Safety)" };

/// Create/edit University Choice — Reach/Match/Safety school selection (F05 instruction
/// §12). `programId` is picked at create time only (identity-establishing, same "locked on
/// edit" precedent as Program's `universityId`); propose a new choice instead of
/// re-pointing an existing one, matching the backend's own DTO shape exactly.
export function UniversityChoiceFormDialog({
  open,
  onClose,
  choice,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  choice?: UniversityChoice;
  /** Pre-fills `caseId` when creating from within a Case context. */
  caseId?: string;
  onSubmit: (input: CreateUniversityChoiceInput | UpdateUniversityChoiceInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!choice;
  const [programId, setProgramId] = useState("");
  const [tier, setTier] = useState<UniversityChoiceTier>("MATCH");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setProgramId("");
    setTier(choice?.tier ?? "MATCH");
    setRationale(choice?.rationale ?? "");
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
        await onSubmit({ tier, rationale: rationale.trim() || undefined } satisfies UpdateUniversityChoiceInput);
      } else {
        await onSubmit({ programId: programId.trim(), tier, rationale: rationale.trim() || undefined, caseId } satisfies CreateUniversityChoiceInput);
      }
      toast({ title: isEdit ? "Đã cập nhật lựa chọn trường." : "Đã thêm lựa chọn trường.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa lựa chọn trường" : "Thêm lựa chọn trường"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {isEdit ? (
          <div>
            <p className="mb-1 text-sm font-medium">Chương trình</p>
            <p className="text-sm text-muted-foreground">
              {choice.program.degreeLevel} · {choice.program.major} — {choice.program.university.officialName}
            </p>
          </div>
        ) : (
          <ProgramPicker value={programId} onChange={setProgramId} label="Chương trình *" />
        )}
        <div>
          <label htmlFor="university-choice-tier" className="mb-1 block text-sm font-medium">
            Phân loại *
          </label>
          <select
            id="university-choice-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as UniversityChoiceTier)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="university-choice-rationale" className="mb-1 block text-sm font-medium">
            Lý do lựa chọn
          </label>
          <Textarea
            id="university-choice-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
          />
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingUniversityChoiceId" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
