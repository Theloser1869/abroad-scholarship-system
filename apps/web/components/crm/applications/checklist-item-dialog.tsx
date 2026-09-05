"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { UserPicker } from "@/components/crm/user-picker";
import { DocumentAttachmentField } from "@/components/crm/documents/document-attachment-field";
import { CHECKLIST_ITEM_STATUS_LABEL } from "@/components/crm/status-badge";
import { CHECKLIST_ITEM_STATUSES, type ApplicationChecklistItem, type ChecklistItemStatus, type CreateChecklistItemInput, type UpdateChecklistItemInput } from "@/lib/applications/types";

/// Create/edit Application checklist item (F05 instruction §16). Completion gate is
/// entirely server-side (`ApplicationsService.submit`'s `CHECKLIST_INCOMPLETE` check) — this
/// dialog only reflects/sets the item's own state, it never decides submission eligibility.
export function ChecklistItemDialog({
  open,
  onClose,
  item,
  caseId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  item?: ApplicationChecklistItem;
  /** Owner for any evidence document uploaded inline through this dialog. */
  caseId: string;
  onSubmit: (input: CreateChecklistItemInput | UpdateChecklistItemInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!item;
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState(true);
  const [ownerId, setOwnerId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<ChecklistItemStatus>("PENDING");
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setTitle(item?.title ?? "");
    setRequired(item?.required ?? true);
    setOwnerId(item?.ownerId ?? "");
    setDeadline(item?.deadline ? item.deadline.slice(0, 10) : "");
    setStatus(item?.status ?? "PENDING");
    setDocumentId(item?.documentId ?? "");
    setNotes(item?.notes ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({
          title: title.trim(),
          required,
          ownerId: ownerId.trim() || undefined,
          deadline: deadline || undefined,
          status,
          documentId: documentId.trim() || undefined,
          notes: notes.trim() || undefined,
        } satisfies UpdateChecklistItemInput);
      } else {
        await onSubmit({
          title: title.trim(),
          required,
          ownerId: ownerId.trim() || undefined,
          deadline: deadline || undefined,
          documentId: documentId.trim() || undefined,
          notes: notes.trim() || undefined,
        } satisfies CreateChecklistItemInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hạng mục." : "Đã thêm hạng mục checklist.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hạng mục checklist" : "Thêm hạng mục checklist"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="checklist-item-title" className="mb-1 block text-sm font-medium">
            Tên hạng mục *
          </label>
          <Input id="checklist-item-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Bắt buộc
        </label>
        <UserPicker value={ownerId} onChange={setOwnerId} label="Người phụ trách (tùy chọn)" required={false} />
        <div>
          <label htmlFor="checklist-item-deadline" className="mb-1 block text-sm font-medium">
            Hạn hoàn thành
          </label>
          <Input id="checklist-item-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {isEdit ? (
          <div>
            <label htmlFor="checklist-item-status" className="mb-1 block text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="checklist-item-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ChecklistItemStatus)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {CHECKLIST_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CHECKLIST_ITEM_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <DocumentAttachmentField
          documentId={documentId}
          onChange={setDocumentId}
          ownerEntity="Case"
          ownerId={caseId}
          documentType="APPLICATION_CHECKLIST_EVIDENCE"
        />
        <div>
          <label htmlFor="checklist-item-notes" className="mb-1 block text-sm font-medium">
            Ghi chú
          </label>
          <Textarea
            id="checklist-item-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
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
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
