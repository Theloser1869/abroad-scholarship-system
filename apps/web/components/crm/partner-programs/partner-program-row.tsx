"use client";

import { useState } from "react";
import { useUpdatePartnerProgram, useArchivePartnerProgram } from "@/lib/partner-programs/hooks";
import { PartnerProgramFormDialog } from "@/components/crm/partner-programs/partner-program-form-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { PartnerProgram } from "@/lib/partner-programs/types";

/// Per-row component so `useUpdatePartnerProgram`/`useArchivePartnerProgram` stay at this
/// component's own top level, never called inline inside a `.map()` (Rules-of-Hooks — same
/// fix pattern F04/F05 already established for this exact shape of bug).
export function PartnerProgramRow({ program, canEdit }: { program: PartnerProgram; canEdit: boolean }) {
  const { toast } = useToast();
  const updateProgram = useUpdatePartnerProgram(program.id);
  const archiveProgram = useArchivePartnerProgram(program.id);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function handleArchive() {
    try {
      await archiveProgram.mutateAsync();
      toast({ title: "Đã lưu trữ chương trình.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="space-y-1 border-b border-border pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{program.name}</span>
          {program.degreeLevel || program.major ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {program.degreeLevel} {program.major}
            </span>
          ) : null}
        </div>
        <StatusBadge status={program.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[program.status]} />
      </div>
      {program.program ? (
        <p className="text-xs text-muted-foreground">
          Liên kết: {program.program.university.officialName} — {program.program.degreeLevel} {program.program.major}
        </p>
      ) : null}
      {program.tuition ? (
        <p className="text-xs text-muted-foreground">
          Học phí: <Money value={program.tuition} currency={program.tuitionCurrency} />
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Sửa
          </Button>
          {program.status === "ACTIVE" ? (
            <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archiveProgram.isPending}>
              Lưu trữ
            </Button>
          ) : null}
        </div>
      ) : null}
      <PartnerProgramFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        program={program}
        onSubmit={(input) => updateProgram.mutateAsync(input)}
        submitting={updateProgram.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ chương trình đối tác"
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archiveProgram.isPending}
      />
    </li>
  );
}
