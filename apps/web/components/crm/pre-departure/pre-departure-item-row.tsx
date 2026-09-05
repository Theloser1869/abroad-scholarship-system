"use client";

import { useState } from "react";
import { useUpdatePreDepartureItem } from "@/lib/pre-departure/hooks";
import { PreDepartureItemDialog } from "@/components/crm/pre-departure/pre-departure-item-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, CHECKLIST_ITEM_STATUS_VARIANT, CHECKLIST_ITEM_STATUS_LABEL } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import type { PreDepartureItem } from "@/lib/pre-departure/types";

/// Per-row component — same Rules-of-Hooks fix pattern as `VisaChecklistItemRow`/F05's
/// `ChecklistItemRow`. Overdue/complete state is rendered exactly as the backend returns it
/// (`status`/`deadline`) — never computed by comparing `deadline` against the client clock
/// (F06 instruction §13).
export function PreDepartureItemRow({ item, caseId, canEdit }: { item: PreDepartureItem; caseId: string; canEdit: boolean }) {
  const updateItem = useUpdatePreDepartureItem(item.id, caseId);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="space-y-1 border-b border-border pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{item.title}</span>
          {item.category ? <span className="ml-2 text-xs text-muted-foreground">{item.category}</span> : null}
          {item.required ? <span className="ml-2 text-xs text-danger">Bắt buộc</span> : <span className="ml-2 text-xs text-muted-foreground">Tùy chọn</span>}
        </div>
        <StatusBadge status={item.status} variantMap={CHECKLIST_ITEM_STATUS_VARIANT} label={CHECKLIST_ITEM_STATUS_LABEL[item.status]} />
      </div>
      {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.deadline ? <span>Hạn: {new Date(item.deadline).toLocaleDateString("vi-VN")}</span> : null}
        <EvidenceDocumentLink documentId={item.documentId} />
        {canEdit ? (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Sửa
          </Button>
        ) : null}
      </div>
      <PreDepartureItemDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        item={item}
        caseId={caseId}
        onSubmit={(input) => updateItem.mutateAsync(input as Parameters<typeof updateItem.mutateAsync>[0])}
        submitting={updateItem.isPending}
      />
    </li>
  );
}
