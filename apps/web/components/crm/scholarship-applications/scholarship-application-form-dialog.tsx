"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { ScholarshipMasterPicker } from "@/components/crm/scholarship-masters/scholarship-master-picker";
import type { Application } from "@/lib/applications/types";
import type { CreateScholarshipApplicationInput, ScholarshipApplication, UpdateScholarshipApplicationInput } from "@/lib/scholarship-applications/types";

/// Create/edit ScholarshipApplication (F05 instruction §21) — kept fully distinct from
/// ScholarshipMaster (`scholarshipMasterId` picked at create time only). `applicationId` is
/// optional (a scholarship may be pursued independent of a specific university Application)
/// and, when offered, is chosen from the Case's own already-loaded Applications — never a
/// manual UUID input, since the case's application list is already on hand.
export function ScholarshipApplicationFormDialog({
  open,
  onClose,
  scholarshipApplication,
  caseApplications,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit; absent = create. */
  scholarshipApplication?: ScholarshipApplication;
  /** The Case's own Applications, for the optional `applicationId` link. */
  caseApplications: Application[];
  onSubmit: (input: CreateScholarshipApplicationInput | UpdateScholarshipApplicationInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!scholarshipApplication;
  const [scholarshipMasterId, setScholarshipMasterId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [essayArtifactId, setEssayArtifactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setScholarshipMasterId("");
    setApplicationId(scholarshipApplication?.applicationId ?? "");
    setDeadline(scholarshipApplication?.deadline ? scholarshipApplication.deadline.slice(0, 10) : "");
    setEssayArtifactId(scholarshipApplication?.essayArtifactId ?? "");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !scholarshipMasterId.trim()) {
      setError("Vui lòng chọn học bổng.");
      return;
    }
    try {
      if (isEdit) {
        await onSubmit({
          applicationId: applicationId || undefined,
          deadline: deadline || undefined,
          essayArtifactId: essayArtifactId.trim() || undefined,
        } satisfies UpdateScholarshipApplicationInput);
      } else {
        await onSubmit({
          scholarshipMasterId: scholarshipMasterId.trim(),
          applicationId: applicationId || undefined,
          deadline: deadline || undefined,
          essayArtifactId: essayArtifactId.trim() || undefined,
        } satisfies CreateScholarshipApplicationInput);
      }
      toast({ title: isEdit ? "Đã cập nhật hồ sơ học bổng." : "Đã tạo hồ sơ học bổng.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa hồ sơ học bổng" : "Tạo hồ sơ học bổng mới"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {isEdit ? (
          <div>
            <p className="mb-1 text-sm font-medium">Học bổng</p>
            <p className="text-sm text-muted-foreground">
              {scholarshipApplication.scholarshipMaster.name} — {scholarshipApplication.scholarshipMaster.provider}
            </p>
          </div>
        ) : (
          <ScholarshipMasterPicker value={scholarshipMasterId} onChange={setScholarshipMasterId} label="Học bổng *" />
        )}
        {caseApplications.length > 0 ? (
          <div>
            <label htmlFor="scholarship-application-application" className="mb-1 block text-sm font-medium">
              Liên kết với hồ sơ ứng tuyển (tùy chọn)
            </label>
            <select
              id="scholarship-application-application"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Không liên kết —</option>
              {caseApplications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.applicationCode} — {a.program.university.officialName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="scholarship-application-deadline" className="mb-1 block text-sm font-medium">
            Hạn nộp
          </label>
          <Input id="scholarship-application-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <label htmlFor="scholarship-application-essay" className="mb-1 block text-sm font-medium">
            Writing Artifact ID (bài luận)
          </label>
          <Input id="scholarship-application-essay" value={essayArtifactId} onChange={(e) => setEssayArtifactId(e.target.value)} placeholder="UUID bài viết (tùy chọn)" />
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo hồ sơ"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
