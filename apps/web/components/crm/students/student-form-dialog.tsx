"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateStudentInput, Student } from "@/lib/students/types";

const EMPTY: CreateStudentInput = {
  fullName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  targetCountry: "",
  targetMajor: "",
  targetIntake: "",
};

/// Shared create/edit dialog. `budget`/`budgetCurrency` are deliberately NOT editable here —
/// this form only ever sends fields it also displays; a role whose `GET` response redacts
/// budget (`FieldPolicyService`) never gets a form field it can't see (F03 instruction §10).
export function StudentFormDialog({
  open,
  onClose,
  student,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  student?: Student;
  onSubmit: (input: CreateStudentInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateStudentInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setError(null);
    setForm(
      student
        ? {
            fullName: student.fullName,
            dateOfBirth: student.dateOfBirth ?? "",
            email: student.email ?? "",
            phone: student.phone ?? "",
            targetCountry: student.targetCountry ?? "",
            targetMajor: student.targetMajor ?? "",
            targetIntake: student.targetIntake ?? "",
          }
        : EMPTY,
    );
  });

  function set<K extends keyof CreateStudentInput>(key: K, value: CreateStudentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setError(null);
    try {
      await onSubmit(form);
      toast({ title: student ? "Đã cập nhật học sinh." : "Đã tạo học sinh.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={student ? "Sửa học sinh" : "Tạo học sinh mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
            Họ tên *
          </label>
          <Input id="fullName" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dateOfBirth" className="mb-1 block text-sm font-medium">
              Ngày sinh
            </label>
            <Input id="dateOfBirth" type="date" value={form.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Điện thoại
            </label>
            <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="targetCountry" className="mb-1 block text-sm font-medium">
              Quốc gia
            </label>
            <Input id="targetCountry" value={form.targetCountry ?? ""} onChange={(e) => set("targetCountry", e.target.value)} />
          </div>
          <div>
            <label htmlFor="targetMajor" className="mb-1 block text-sm font-medium">
              Ngành
            </label>
            <Input id="targetMajor" value={form.targetMajor ?? ""} onChange={(e) => set("targetMajor", e.target.value)} />
          </div>
          <div>
            <label htmlFor="targetIntake" className="mb-1 block text-sm font-medium">
              Kỳ nhập học
            </label>
            <Input id="targetIntake" value={form.targetIntake ?? ""} onChange={(e) => set("targetIntake", e.target.value)} />
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
          <Button type="submit" disabled={submitting || !form.fullName.trim()}>
            {submitting ? "Đang lưu..." : student ? "Lưu thay đổi" : "Tạo học sinh"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
