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
import type { CreateWritingArtifactInput } from "@/lib/writing/types";

/// `type` is free text (Resume/Essay/SOP/Motivation Letter/Study Plan/LOR/custom — F04
/// instruction §28, verified against `CreateWritingArtifactDto`). Optional initial content
/// creates version 1 directly; an empty artifact can have its first version added afterward
/// via `WritingVersionDialog`.
export function WritingArtifactFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWritingArtifactInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setType("");
    setTitle("");
    setOwnerId("");
    setContent("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type.trim() || !title.trim()) return;
    setError(null);
    try {
      await onSubmit({ type: type.trim(), title: title.trim(), ownerId: ownerId || undefined, content: content || undefined });
      toast({ title: "Đã tạo bài viết.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Tạo bài viết mới">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="writing-type" className="mb-1 block text-sm font-medium">
              Loại *
            </label>
            <Input id="writing-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="Essay, SOP, Resume..." required />
          </div>
          <div>
            <label htmlFor="writing-title" className="mb-1 block text-sm font-medium">
              Tiêu đề *
            </label>
            <Input id="writing-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
        </div>
        <UserPicker value={ownerId} onChange={setOwnerId} label="Người phụ trách (tùy chọn)" required={false} />
        <div>
          <label htmlFor="writing-content" className="mb-1 block text-sm font-medium">
            Nội dung ban đầu (tùy chọn)
          </label>
          <Textarea
            id="writing-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
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
          <Button type="submit" disabled={submitting || !type.trim() || !title.trim()}>
            {submitting ? "Đang tạo..." : "Tạo"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
