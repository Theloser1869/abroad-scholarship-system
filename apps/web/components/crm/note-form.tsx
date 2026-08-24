"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/types";

/// Reusable across Lead/Student/Case (F03 instruction §19) — always goes through the shared
/// Comment API (`POST .../notes`), never a frontend-only note store. `visibility` is only
/// offered when the caller says notes-with-visibility are in scope for that entity.
export function NoteForm({
  onSubmit,
  allowSharedVisibility = true,
}: {
  onSubmit: (input: { body: string; visibility?: "internal" | "shared" }) => Promise<unknown>;
  allowSharedVisibility?: boolean;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "shared">("internal");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ body: body.trim(), visibility: allowSharedVisibility ? visibility : "internal" });
      setBody("");
      toast({ title: "Đã thêm ghi chú.", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.raw.message : "Không thể thêm ghi chú.";
      toast({ title: "Lỗi", description: message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="note-body" className="sr-only">
        Nội dung ghi chú
      </label>
      <Textarea
        id="note-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Thêm ghi chú..."
        rows={3}
      />
      <div className="flex items-center justify-between">
        {allowSharedVisibility ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={visibility === "shared"}
              onChange={(e) => setVisibility(e.target.checked ? "shared" : "internal")}
            />
            Hiển thị cho học sinh/phụ huynh
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting || !body.trim()}>
          {submitting ? "Đang gửi..." : "Thêm ghi chú"}
        </Button>
      </div>
    </form>
  );
}
