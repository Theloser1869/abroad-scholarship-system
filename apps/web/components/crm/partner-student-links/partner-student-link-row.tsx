"use client";

import { useState } from "react";
import { useArchivePartnerStudentLink } from "@/lib/partner-student-links/hooks";
import { StatusBadge, PARTNER_LINK_STATUS_VARIANT, PARTNER_LINK_STATUS_LABEL } from "@/components/crm/status-badge";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { PartnerStudentLink } from "@/lib/partner-student-links/types";

/// Per-row component — same Rules-of-Hooks fix pattern as `PartnerProgramRow`. No hard
/// delete (Hard Rule #5) — archive stamps `endDate`, preserving history.
export function PartnerStudentLinkRow({ link, canEdit }: { link: PartnerStudentLink; canEdit: boolean }) {
  const { toast } = useToast();
  const archiveLink = useArchivePartnerStudentLink(link.id);
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function handleArchive() {
    try {
      await archiveLink.mutateAsync();
      toast({ title: "Đã lưu trữ liên kết.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="space-y-1 border-b border-border pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {link.student.fullName} <span className="text-xs text-muted-foreground">({link.student.studentCode})</span>
        </span>
        <StatusBadge status={link.status} variantMap={PARTNER_LINK_STATUS_VARIANT} label={PARTNER_LINK_STATUS_LABEL[link.status]} />
      </div>
      <p className="text-xs text-muted-foreground">
        {link.linkType}
        {link.effectiveDate ? ` · Hiệu lực từ ${new Date(link.effectiveDate).toLocaleDateString("vi-VN")}` : ""}
      </p>
      {canEdit && link.status === "ACTIVE" ? (
        <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archiveLink.isPending}>
          Lưu trữ
        </Button>
      ) : null}
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ liên kết đối tác — học sinh"
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archiveLink.isPending}
      />
    </li>
  );
}
