"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DuplicateConflictNotice } from "@/components/crm/duplicate-conflict-notice";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateUniversityInput, University, UpdateUniversityInput } from "@/lib/universities/types";

/// Create/edit University master data (F05 instruction §7). Duplicate detection
/// (`409 DUPLICATE_UNIVERSITY`) is entirely backend-decided — this form only submits and
/// renders whatever conflict the server reports, via the shared `DuplicateConflictNotice`.
export function UniversityFormDialog({
  open,
  onClose,
  university,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  university?: University;
  onSubmit: (input: CreateUniversityInput | UpdateUniversityInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!university;
  const [officialName, setOfficialName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");
  const [website, setWebsite] = useState("");
  const [admissionsUrl, setAdmissionsUrl] = useState("");
  const [error, setError] = useState<unknown>(null);
  const { toast } = useToast();
  const router = useRouter();

  useResetOnOpen(open, () => {
    setOfficialName(university?.officialName ?? "");
    setCountryCode(university?.countryCode ?? "");
    setCity(university?.city ?? "");
    setCampus(university?.campus ?? "");
    setWebsite(university?.website ?? "");
    setAdmissionsUrl(university?.admissionsUrl ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = {
        officialName: officialName.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        city: city.trim() || undefined,
        campus: campus.trim() || undefined,
        website: website.trim() || undefined,
        admissionsUrl: admissionsUrl.trim() || undefined,
      } satisfies CreateUniversityInput;
      const created = await onSubmit(input);
      toast({ title: isEdit ? "Đã cập nhật trường đại học." : "Đã tạo trường đại học.", variant: "success" });
      onClose();
      if (!isEdit && created && typeof created === "object" && "id" in created) {
        router.push(`/universities/${(created as { id: string }).id}`);
      }
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa trường đại học" : "Tạo trường đại học mới"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="university-official-name" className="mb-1 block text-sm font-medium">
            Tên chính thức *
          </label>
          <Input id="university-official-name" value={officialName} onChange={(e) => setOfficialName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="university-country" className="mb-1 block text-sm font-medium">
              Mã quốc gia (ISO-2) *
            </label>
            <Input id="university-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required placeholder="US, GB, CA..." />
          </div>
          <div>
            <label htmlFor="university-city" className="mb-1 block text-sm font-medium">
              Thành phố
            </label>
            <Input id="university-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="university-campus" className="mb-1 block text-sm font-medium">
            Cơ sở
          </label>
          <Input id="university-campus" value={campus} onChange={(e) => setCampus(e.target.value)} />
        </div>
        <div>
          <label htmlFor="university-website" className="mb-1 block text-sm font-medium">
            Website
          </label>
          <Input id="university-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label htmlFor="university-admissions-url" className="mb-1 block text-sm font-medium">
            Trang tuyển sinh
          </label>
          <Input id="university-admissions-url" value={admissionsUrl} onChange={(e) => setAdmissionsUrl(e.target.value)} placeholder="https://..." />
        </div>
        {error ? (
          <DuplicateConflictNotice error={error} existingIdField="existingUniversityId" hrefBuilder={(id) => `/universities/${id}`} linkLabel="Xem trường đại học đã tồn tại →" />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo trường"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
