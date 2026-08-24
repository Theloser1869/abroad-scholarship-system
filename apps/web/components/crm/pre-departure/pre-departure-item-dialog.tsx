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
import { CHECKLIST_ITEM_STATUS_LABEL } from "@/components/crm/status-badge";
import { CHECKLIST_ITEM_STATUSES, type ChecklistItemStatus } from "@/lib/visas/types";
import type { CreatePreDepartureItemInput, PreDepartureItem, UpdatePreDepartureItemInput } from "@/lib/pre-departure/types";

/// Create/edit Pre-departure checklist item (F06 instruction §13). `category` is free text —
/// suggested passport/visa/flight/insurance/accommodation/airport-transfer/orientation/
/// emergency-contact/tuition-deposit/travel-documents groupings, never a hard-coded
/// dropdown (no configurable-category master-data endpoint exists, same precedent as F04's
/// Activity.category). Completeness is enforced only at Case Closure — this dialog never
/// computes or claims overall completion itself.
export function PreDepartureItemDialog({
  open,
  onClose,
  item,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  item?: PreDepartureItem;
  onSubmit: (input: CreatePreDepartureItemInput | UpdatePreDepartureItemInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!item;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
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
    setCategory(item?.category ?? "");
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
      const base = {
        title: title.trim(),
        category: category.trim() || undefined,
        required,
        ownerId: ownerId.trim() || undefined,
        deadline: deadline || undefined,
        documentId: documentId.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (isEdit) {
        await onSubmit({ ...base, status } satisfies UpdatePreDepartureItemInput);
      } else {
        await onSubmit(base satisfies CreatePreDepartureItemInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hạng mục." : "Đã thêm hạng mục checklist.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hạng mục trước khi khởi hành" : "Thêm hạng mục trước khi khởi hành"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="pre-departure-item-title" className="mb-1 block text-sm font-medium">
            Tên hạng mục *
          </label>
          <Input id="pre-departure-item-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="pre-departure-item-category" className="mb-1 block text-sm font-medium">
            Nhóm
          </label>
          <Input id="pre-departure-item-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Hộ chiếu, Visa, Vé máy bay, Bảo hiểm..." />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Bắt buộc
        </label>
        <UserPicker value={ownerId} onChange={setOwnerId} label="Người phụ trách (tùy chọn)" required={false} />
        <div>
          <label htmlFor="pre-departure-item-deadline" className="mb-1 block text-sm font-medium">
            Hạn hoàn thành
          </label>
          <Input id="pre-departure-item-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {isEdit ? (
          <div>
            <label htmlFor="pre-departure-item-status" className="mb-1 block text-sm font-medium">
              Trạng thái
            </label>
            <select
              id="pre-departure-item-status"
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
        <div>
          <label htmlFor="pre-departure-item-document" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="pre-departure-item-document" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
        </div>
        <div>
          <label htmlFor="pre-departure-item-notes" className="mb-1 block text-sm font-medium">
            Ghi chú
          </label>
          <Textarea
            id="pre-departure-item-notes"
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
