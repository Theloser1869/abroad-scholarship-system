"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateVisaChecklistTemplateInput, UpdateVisaChecklistTemplateInput, VisaChecklistTemplate } from "@/lib/visa-checklist-templates/types";

/// Create/edit VisaChecklistTemplate — GLOBAL master/config data (F06 instruction §17-shaped).
/// No dedicated detail route exists (F01 never mapped one) — create/edit is a Dialog from
/// the list page, same "no invented route" precedent as F04's Payment/Milestone.
export function VisaChecklistTemplateFormDialog({
  open,
  onClose,
  template,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  template?: VisaChecklistTemplate;
  onSubmit: (input: CreateVisaChecklistTemplateInput | UpdateVisaChecklistTemplateInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!template;
  const [countryCode, setCountryCode] = useState("");
  const [visaType, setVisaType] = useState("");
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState(true);
  const [sortOrder, setSortOrder] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setCountryCode(template?.countryCode ?? "");
    setVisaType(template?.visaType ?? "");
    setTitle(template?.title ?? "");
    setRequired(template?.required ?? true);
    setSortOrder(template?.sortOrder != null ? String(template.sortOrder) : "");
    setActive(template?.active ?? true);
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        countryCode: countryCode.trim().toUpperCase(),
        visaType: visaType.trim(),
        title: title.trim(),
        required,
        sortOrder: sortOrder ? Number(sortOrder) : undefined,
        active,
      });
      toast({ title: isEdit ? "Đã cập nhật mẫu checklist." : "Đã tạo mẫu checklist.", variant: "success" });
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa mẫu checklist visa" : "Tạo mẫu checklist visa"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="visa-template-country" className="mb-1 block text-sm font-medium">
              Mã quốc gia (ISO-2) *
            </label>
            <Input id="visa-template-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required />
          </div>
          <div>
            <label htmlFor="visa-template-type" className="mb-1 block text-sm font-medium">
              Loại visa *
            </label>
            <Input id="visa-template-type" value={visaType} onChange={(e) => setVisaType(e.target.value)} placeholder="Student, Work..." required />
          </div>
        </div>
        <div>
          <label htmlFor="visa-template-title" className="mb-1 block text-sm font-medium">
            Tên hạng mục *
          </label>
          <Input id="visa-template-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Bắt buộc
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Đang áp dụng
          </label>
        </div>
        <div>
          <label htmlFor="visa-template-sort" className="mb-1 block text-sm font-medium">
            Thứ tự hiển thị
          </label>
          <Input id="visa-template-sort" type="number" step="1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingTemplateId" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo mẫu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
