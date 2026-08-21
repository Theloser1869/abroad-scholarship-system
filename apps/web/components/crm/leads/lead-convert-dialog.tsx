"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/types";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import type { ConvertLeadInput, ConvertLeadResult, DuplicateStudentCandidate } from "@/lib/leads/types";

/// Explains the workflow, confirms, calls the dedicated `POST /leads/:id/convert` endpoint,
/// and navigates using the ID from the RESPONSE — never constructs a Student/Case
/// client-side. Duplicate detection/merge/creation is entirely backend-resolved: a
/// `409 DUPLICATE_STUDENT_CANDIDATES` just re-renders this same dialog with the candidates
/// the backend found, offering MERGE (pick one) or CREATE_NEW, then resubmits with
/// `confirmMatch` set (F03 instruction §9).
export function LeadConvertDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ConvertLeadInput) => Promise<ConvertLeadResult>;
  submitting: boolean;
}) {
  const [candidates, setCandidates] = useState<DuplicateStudentCandidate[] | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useResetOnOpen(open, () => {
    setCandidates(null);
    setSelectedStudentId("");
    setError(null);
  });

  async function attempt(input: ConvertLeadInput) {
    setError(null);
    try {
      const result = await onSubmit(input);
      toast({
        title: "Đã chuyển đổi lead.",
        description: result.merged ? "Đã gộp vào học sinh hiện có." : "Đã tạo học sinh mới.",
        variant: "success",
      });
      onClose();
      router.push(`/cases/${result.case.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_STUDENT_CANDIDATES") {
        const rawCandidates = err.raw.candidates;
        setCandidates(Array.isArray(rawCandidates) ? (rawCandidates as DuplicateStudentCandidate[]) : []);
        return;
      }
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Chuyển đổi lead thành học sinh">
      {candidates === null ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hệ thống sẽ kiểm tra học sinh trùng lặp, sau đó tạo Học sinh và Case mới (hoặc gộp vào
            học sinh hiện có nếu phát hiện trùng khớp). Thao tác này không thể hoàn tác.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </Button>
            <Button type="button" onClick={() => attempt({})} disabled={submitting}>
              {submitting ? "Đang xử lý..." : "Xác nhận chuyển đổi"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">Phát hiện học sinh có thể trùng khớp:</p>
          <ul className="space-y-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex items-start gap-2 rounded border border-border p-2 text-sm">
                  <input
                    type="radio"
                    name="duplicate-candidate"
                    checked={selectedStudentId === c.id}
                    onChange={() => setSelectedStudentId(c.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">
                      {c.fullName} ({c.studentCode})
                    </span>
                    <span className="block text-muted-foreground">
                      {c.email ?? "—"} · {c.phone ?? "—"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </Button>
            <Button type="button" variant="secondary" onClick={() => attempt({ confirmMatch: "CREATE_NEW" })} disabled={submitting}>
              Tạo học sinh mới
            </Button>
            <Button
              type="button"
              onClick={() => attempt({ confirmMatch: "MERGE", mergeIntoStudentId: selectedStudentId })}
              disabled={submitting || !selectedStudentId}
            >
              Gộp vào học sinh đã chọn
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
