"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { CreateResearchProjectInput, ResearchProject, UpdateResearchProjectInput } from "@/lib/profile-evidence/types";

/// Kept separate from Activity/Writing (F04 instruction §26) — its own mentor/methodology/
/// publication shape neither of those captures.
export function ResearchProjectDialog({
  open,
  onClose,
  record,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: ResearchProject;
  onSubmit: (input: CreateResearchProjectInput | UpdateResearchProjectInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [mentor, setMentor] = useState("");
  const [role, setRole] = useState("");
  const [methodology, setMethodology] = useState("");
  const [output, setOutput] = useState("");
  const [publication, setPublication] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setTitle(record?.title ?? "");
    setMentor(record?.mentor ?? "");
    setRole(record?.role ?? "");
    setMethodology(record?.methodology ?? "");
    setOutput(record?.output ?? "");
    setPublication(record?.publication ?? "");
    setEvidenceDocumentId(record?.evidenceDocumentId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        mentor: mentor || undefined,
        role: role || undefined,
        methodology: methodology || undefined,
        output: output || undefined,
        publication: publication || undefined,
        evidenceDocumentId: evidenceDocumentId || undefined,
      });
      toast({ title: "Đã lưu dự án nghiên cứu.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={record ? "Sửa dự án nghiên cứu" : "Thêm dự án nghiên cứu"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="research-title" className="mb-1 block text-sm font-medium">
            Tên dự án *
          </label>
          <Input id="research-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="research-mentor" className="mb-1 block text-sm font-medium">
              Người hướng dẫn
            </label>
            <Input id="research-mentor" value={mentor} onChange={(e) => setMentor(e.target.value)} />
          </div>
          <div>
            <label htmlFor="research-role" className="mb-1 block text-sm font-medium">
              Vai trò
            </label>
            <Input id="research-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="research-methodology" className="mb-1 block text-sm font-medium">
            Phương pháp
          </label>
          <Input id="research-methodology" value={methodology} onChange={(e) => setMethodology(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="research-output" className="mb-1 block text-sm font-medium">
              Kết quả
            </label>
            <Input id="research-output" value={output} onChange={(e) => setOutput(e.target.value)} />
          </div>
          <div>
            <label htmlFor="research-publication" className="mb-1 block text-sm font-medium">
              Xuất bản
            </label>
            <Input id="research-publication" value={publication} onChange={(e) => setPublication(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="research-evidence" className="mb-1 block text-sm font-medium">
            Document ID minh chứng
          </label>
          <Input id="research-evidence" value={evidenceDocumentId} onChange={(e) => setEvidenceDocumentId(e.target.value)} placeholder="UUID tài liệu (tùy chọn)" />
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
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
