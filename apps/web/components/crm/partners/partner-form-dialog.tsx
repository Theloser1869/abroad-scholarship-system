"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { PARTNER_TYPES, type CreatePartnerInput, type Partner, type PartnerType, type UpdatePartnerInput } from "@/lib/partners/types";

const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  UNIVERSITY_REPRESENTATIVE: "Đại diện trường",
  AGENCY: "Đại lý",
  LANGUAGE_CENTER: "Trung tâm ngoại ngữ",
  OTHER: "Khác",
};

/// Create/edit Partner — GLOBAL master data (F06 instruction §17). Duplicate detection
/// (`409 DUPLICATE_PARTNER`) is entirely backend-decided, same `DuplicateConflictNotice`
/// pattern as University/Program/ScholarshipMaster (F05).
export function PartnerFormDialog({
  open,
  onClose,
  partner,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  partner?: Partner;
  onSubmit: (input: CreatePartnerInput | UpdatePartnerInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!partner;
  const [name, setName] = useState("");
  const [type, setType] = useState<PartnerType>("AGENCY");
  const [countryCode, setCountryCode] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();
  const router = useRouter();

  useResetOnOpen(open, () => {
    setName(partner?.name ?? "");
    setType(partner?.type ?? "AGENCY");
    setCountryCode(partner?.countryCode ?? "");
    setContactName(partner?.contactName ?? "");
    setContactEmail(partner?.contactEmail ?? "");
    setContactPhone(partner?.contactPhone ?? "");
    setWebsite(partner?.website ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = {
        name: name.trim(),
        type,
        countryCode: countryCode.trim().toUpperCase(),
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        website: website.trim() || undefined,
      } satisfies CreatePartnerInput;
      const created = await onSubmit(input);
      toast({ title: isEdit ? "Đã cập nhật đối tác." : "Đã tạo đối tác.", variant: "success" });
      onClose();
      if (!isEdit && created && typeof created === "object" && "id" in created) {
        router.push(`/partners/${(created as { id: string }).id}`);
      }
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa đối tác" : "Tạo đối tác mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-name" className="mb-1 block text-sm font-medium">
              Tên đối tác *
            </label>
            <Input id="partner-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="partner-type" className="mb-1 block text-sm font-medium">
              Loại đối tác *
            </label>
            <select id="partner-type" value={type} onChange={(e) => setType(e.target.value as PartnerType)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PARTNER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="partner-country" className="mb-1 block text-sm font-medium">
            Mã quốc gia (ISO-2) *
          </label>
          <Input id="partner-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-contact-name" className="mb-1 block text-sm font-medium">
              Người liên hệ
            </label>
            <Input id="partner-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="partner-contact-email" className="mb-1 block text-sm font-medium">
              Email liên hệ
            </label>
            <Input id="partner-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="partner-contact-phone" className="mb-1 block text-sm font-medium">
              Điện thoại liên hệ
            </label>
            <Input id="partner-contact-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="partner-website" className="mb-1 block text-sm font-medium">
              Website
            </label>
            <Input id="partner-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        {error ? <DuplicateConflictNotice error={error} existingIdField="existingPartnerId" hrefBuilder={(id) => `/partners/${id}`} linkLabel="Xem đối tác đã tồn tại →" /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo đối tác"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
