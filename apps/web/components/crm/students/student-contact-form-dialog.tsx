"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateStudentContactInput } from "@/lib/students/types";

const EMPTY: CreateStudentContactInput = { type: "PARENT", name: "", relationship: "", phone: "", email: "" };

export function StudentContactFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateStudentContactInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateStudentContactInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setForm(EMPTY);
    setError(null);
  });

  function set<K extends keyof CreateStudentContactInput>(key: K, value: CreateStudentContactInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      await onSubmit(form);
      toast({ title: "Đã thêm liên hệ.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Thêm liên hệ">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="contact-type" className="mb-1 block text-sm font-medium">
            Loại liên hệ *
          </label>
          <select
            id="contact-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="PARENT">Phụ huynh</option>
            <option value="GUARDIAN">Người giám hộ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-medium">
            Họ tên *
          </label>
          <Input id="contact-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor="contact-relationship" className="mb-1 block text-sm font-medium">
            Quan hệ
          </label>
          <Input id="contact-relationship" value={form.relationship ?? ""} onChange={(e) => set("relationship", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium">
              Điện thoại
            </label>
            <Input id="contact-phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label htmlFor="contact-email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input id="contact-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
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
          <Button type="submit" disabled={submitting || !form.name.trim()}>
            {submitting ? "Đang lưu..." : "Thêm liên hệ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
