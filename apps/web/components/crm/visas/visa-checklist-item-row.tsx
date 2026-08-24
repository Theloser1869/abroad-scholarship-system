"use client";

import { useState } from "react";
import { useUpdateVisaChecklistItem } from "@/lib/visas/hooks";
import { VisaChecklistItemDialog } from "@/components/crm/visas/visa-checklist-item-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { StatusBadge, CHECKLIST_ITEM_STATUS_VARIANT, CHECKLIST_ITEM_STATUS_LABEL } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import type { VisaChecklistItem } from "@/lib/visas/types";

/// Per-row component so `useUpdateVisaChecklistItem`'s hook stays at this component's own
/// top level, never called inline inside a `.map()` (Rules-of-Hooks — same fix pattern F05
/// established for `ChecklistItemRow`).
export function VisaChecklistItemRow({ item, visaId, canEdit }: { item: VisaChecklistItem; visaId: string; canEdit: boolean }) {
  const updateItem = useUpdateVisaChecklistItem(item.id, visaId);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="space-y-1 border-b border-border pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{item.title}</span>
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
      <VisaChecklistItemDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        item={item}
        onSubmit={(input) => updateItem.mutateAsync(input as Parameters<typeof updateItem.mutateAsync>[0])}
        submitting={updateItem.isPending}
      />
    </li>
  );
}
