"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CountryPicker } from "@/components/crm/countries/country-picker";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateLeadInput, Lead } from "@/lib/leads/types";

const EMPTY: CreateLeadInput = {
  contactName: "",
  parentName: "",
  email: "",
  phone: "",
  parentPhone: "",
  source: "",
  campaign: "",
  countryInterest: "",
  majorInterest: "",
  intake: "",
  serviceInterest: "",
};

/// Shared create/edit dialog — `lead` present = edit (dirty-state PATCH of only changed
/// fields is unnecessary here since `UpdateLeadInput` is a `Partial<CreateLeadInput>` the
/// backend already accepts wholesale). Never sends `status`/`ownerId` through this form
/// (those go through dedicated status/assign endpoints, F03 instruction §6).
export function LeadFormDialog({
  open,
  onClose,
  lead,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead;
  onSubmit: (input: CreateLeadInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateLeadInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setError(null);
    setForm(
      lead
        ? {
            contactName: lead.contactName,
            parentName: lead.parentName ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            parentPhone: lead.parentPhone ?? "",
            source: lead.source ?? "",
            campaign: lead.campaign ?? "",
            countryInterest: lead.countryInterest ?? "",
            majorInterest: lead.majorInterest ?? "",
            intake: lead.intake ?? "",
            serviceInterest: lead.serviceInterest ?? "",
          }
        : EMPTY,
    );
  });

  function set<K extends keyof CreateLeadInput>(key: K, value: CreateLeadInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contactName.trim()) return;
    setError(null);
    try {
      await onSubmit({
        contactName: form.contactName.trim(),
        parentName: form.parentName?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        parentPhone: form.parentPhone?.trim() || undefined,
        source: form.source?.trim() || undefined,
        campaign: form.campaign?.trim() || undefined,
        countryInterest: form.countryInterest?.trim() || undefined,
        majorInterest: form.majorInterest?.trim() || undefined,
        intake: form.intake?.trim() || undefined,
        serviceInterest: form.serviceInterest?.trim() || undefined,
      });
      toast({ title: lead ? "Đã cập nhật lead." : "Đã tạo lead.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={lead ? "Sửa lead" : "Tạo lead mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="contactName" className="mb-1 block text-sm font-medium">
            Tên liên hệ *
          </label>
          <Input id="contactName" required value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="parentName" className="mb-1 block text-sm font-medium">
              Tên phụ huynh
            </label>
            <Input id="parentName" value={form.parentName ?? ""} onChange={(e) => set("parentName", e.target.value)} />
          </div>
          <div>
            <label htmlFor="parentPhone" className="mb-1 block text-sm font-medium">
              SĐT phụ huynh
            </label>
            <Input id="parentPhone" value={form.parentPhone ?? ""} onChange={(e) => set("parentPhone", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              SĐT học sinh
            </label>
            <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CountryPicker
            label="Quốc gia quan tâm"
            value={form.countryInterest ?? ""}
            onChange={(code) => set("countryInterest", code)}
          />
          <div>
            <label htmlFor="majorInterest" className="mb-1 block text-sm font-medium">
              Ngành quan tâm
            </label>
            <Input id="majorInterest" value={form.majorInterest ?? ""} onChange={(e) => set("majorInterest", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="intake" className="mb-1 block text-sm font-medium">
              Kỳ nhập học
            </label>
            <Input id="intake" value={form.intake ?? ""} onChange={(e) => set("intake", e.target.value)} />
          </div>
          <div>
            <label htmlFor="source" className="mb-1 block text-sm font-medium">
              Nguồn
            </label>
            <Input id="source" value={form.source ?? ""} onChange={(e) => set("source", e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="campaign" className="mb-1 block text-sm font-medium">
            Chiến dịch
          </label>
          <Input id="campaign" value={form.campaign ?? ""} onChange={(e) => set("campaign", e.target.value)} />
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
          <Button type="submit" disabled={submitting || !form.contactName.trim()}>
            {submitting ? "Đang lưu..." : lead ? "Lưu thay đổi" : "Tạo lead"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
