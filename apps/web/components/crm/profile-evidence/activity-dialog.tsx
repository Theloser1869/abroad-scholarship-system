"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { Activity, CreateActivityInput, UpdateActivityInput } from "@/lib/profile-evidence/types";

/// `category` is free text — no hardcoded/fixed category list, no master-data lookup
/// endpoint exists for this (F04 instruction §27 — verified directly against the backend).
export function ActivityDialog({
  open,
  onClose,
  record,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: Activity;
  onSubmit: (input: CreateActivityInput | UpdateActivityInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [impact, setImpact] = useState("");
  const [award, setAward] = useState("");
  const [verifierName, setVerifierName] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setOrganization(record?.organization ?? "");
    setRole(record?.role ?? "");
    setCategory(record?.category ?? "");
    setDescription(record?.description ?? "");
    setHours(record?.hours ?? "");
    setImpact(record?.impact ?? "");
    setAward(record?.award ?? "");
    setVerifierName(record?.verifierName ?? "");
    setEvidenceDocumentId(record?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organization.trim()) return;
    setError(null);
    try {
      await onSubmit({
        organization: organization.trim(),
        role: role || undefined,
        category: category || undefined,
        description: description || undefined,
        hours: hours ? Number(hours) : undefined,
        impact: impact || undefined,
        award: award || undefined,
        verifierName: verifierName || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
      });
      toast({ title: "Đã lưu hoạt động ngoại khóa.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={record ? "Sửa hoạt động ngoại khóa" : "Thêm hoạt động ngoại khóa"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="activity-organization" className="mb-1 block text-sm font-medium">
              Tổ chức *
            </label>
            <Input id="activity-organization" value={organization} onChange={(e) => setOrganization(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="activity-role" className="mb-1 block text-sm font-medium">
              Vai trò
            </label>
            <Input id="activity-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="activity-category" className="mb-1 block text-sm font-medium">
              Danh mục
            </label>
            <Input id="activity-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Thể thao, tình nguyện, CLB..." />
          </div>
          <div>
            <label htmlFor="activity-hours" className="mb-1 block text-sm font-medium">
              Số giờ
            </label>
            <Input id="activity-hours" type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="activity-description" className="mb-1 block text-sm font-medium">
            Mô tả
          </label>
          <Textarea
            id="activity-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="activity-impact" className="mb-1 block text-sm font-medium">
              Tác động
            </label>
            <Input id="activity-impact" value={impact} onChange={(e) => setImpact(e.target.value)} />
          </div>
          <div>
            <label htmlFor="activity-award" className="mb-1 block text-sm font-medium">
              Giải thưởng
            </label>
            <Input id="activity-award" value={award} onChange={(e) => setAward(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="activity-verifier" className="mb-1 block text-sm font-medium">
              Người xác minh
            </label>
            <Input id="activity-verifier" value={verifierName} onChange={(e) => setVerifierName(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="activity-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="activity-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
          <Button type="submit" disabled={submitting || !organization.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
