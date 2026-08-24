"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { RecordInterviewInput } from "@/lib/visas/types";

/// APPOINTMENT → INTERVIEW. `interviewNotes` is visible to the affected Student/Parent
/// (their own interview record) — never redacted, unlike `Visa.internalNotes`.
export function VisaInterviewDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: RecordInterviewInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setInterviewAt("");
    setInterviewNotes("");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ interviewAt, interviewNotes: interviewNotes.trim() || undefined });
      toast({ title: "Đã ghi nhận phỏng vấn.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ghi nhận phỏng vấn visa">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="visa-interview-at" className="mb-1 block text-sm font-medium">
            Ngày giờ phỏng vấn *
          </label>
          <Input id="visa-interview-at" type="datetime-local" value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="visa-interview-notes" className="mb-1 block text-sm font-medium">
            Ghi chú phỏng vấn
          </label>
          <Textarea
            id="visa-interview-notes"
            value={interviewNotes}
            onChange={(e) => setInterviewNotes(e.target.value)}
            rows={3}
          />
          <p className="mt-1 text-xs text-muted-foreground">Ghi chú này hiển thị cho học sinh/phụ huynh — đây là kết quả phỏng vấn của chính họ.</p>
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
          <Button type="submit" disabled={submitting || !interviewAt}>
            {submitting ? "Đang lưu..." : "Ghi nhận"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
