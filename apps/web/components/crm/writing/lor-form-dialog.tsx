"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useResetOnOpen } from "@/lib/utils/use-reset-on-open";
import { LOR_REQUEST_STATUSES, LOR_SUBMISSION_STATUSES, type CreateLorInput, type LetterOfRecommendation, type LorRequestStatus, type LorSubmissionStatus, type UpdateLorInput } from "@/lib/lor/types";

const REQUEST_LABEL: Record<LorRequestStatus, string> = {
  NOT_REQUESTED: "Chưa yêu cầu",
  REQUESTED: "Đã yêu cầu",
  IN_PROGRESS: "Đang thực hiện",
  RECEIVED: "Đã nhận",
  DECLINED: "Từ chối",
};

const SUBMISSION_LABEL: Record<LorSubmissionStatus, string> = {
  PENDING: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  NOT_REQUIRED: "Không yêu cầu",
};

/// Create/edit tracking record — never a content/version workflow (LOR has none, unlike
/// WritingArtifact/WritingVersion). Status fields (`requestStatus`/`submissionStatus`) are
/// only offered while editing, matching what `UpdateLorDto` actually accepts.
export function LorFormDialog({
  open,
  onClose,
  record,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  record?: LetterOfRecommendation;
  onSubmit: (input: CreateLorInput | UpdateLorInput) => Promise<unknown>;
  submitting: boolean;
}) {
  const isEdit = !!record;
  const [recommenderName, setRecommenderName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deadline, setDeadline] = useState("");
  const [requestStatus, setRequestStatus] = useState<LorRequestStatus>("NOT_REQUESTED");
  const [submissionStatus, setSubmissionStatus] = useState<LorSubmissionStatus>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useResetOnOpen(open, () => {
    setRecommenderName(record?.recommenderName ?? "");
    setRelationship(record?.relationship ?? "");
    setContactEmail(record?.contactEmail ?? "");
    setContactPhone(record?.contactPhone ?? "");
    setDeadline(record?.deadline ? record.deadline.slice(0, 10) : "");
    setRequestStatus(record?.requestStatus ?? "NOT_REQUESTED");
    setSubmissionStatus(record?.submissionStatus ?? "PENDING");
    setError(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recommenderName.trim()) return;
    setError(null);
    try {
      const base = {
        recommenderName: recommenderName.trim(),
        relationship: relationship || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        deadline: deadline || undefined,
      };
      await onSubmit(isEdit ? { ...base, requestStatus, submissionStatus } : base);
      toast({ title: isEdit ? "Đã cập nhật LOR." : "Đã thêm LOR.", variant: "success" });
      onClose();
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Sửa thư giới thiệu (LOR)" : "Thêm thư giới thiệu (LOR)"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lor-recommender" className="mb-1 block text-sm font-medium">
              Người giới thiệu *
            </label>
            <Input id="lor-recommender" value={recommenderName} onChange={(e) => setRecommenderName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="lor-relationship" className="mb-1 block text-sm font-medium">
              Mối quan hệ
            </label>
            <Input id="lor-relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Giáo viên, cố vấn..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lor-email" className="mb-1 block text-sm font-medium">
              Email liên hệ
            </label>
            <Input id="lor-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lor-phone" className="mb-1 block text-sm font-medium">
              Điện thoại
            </label>
            <Input id="lor-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="lor-deadline" className="mb-1 block text-sm font-medium">
            Hạn chót
          </label>
          <Input id="lor-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {isEdit ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lor-request-status" className="mb-1 block text-sm font-medium">
                Trạng thái yêu cầu
              </label>
              <select
                id="lor-request-status"
                value={requestStatus}
                onChange={(e) => setRequestStatus(e.target.value as LorRequestStatus)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {LOR_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REQUEST_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lor-submission-status" className="mb-1 block text-sm font-medium">
                Trạng thái nộp
              </label>
              <select
                id="lor-submission-status"
                value={submissionStatus}
                onChange={(e) => setSubmissionStatus(e.target.value as LorSubmissionStatus)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {LOR_SUBMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SUBMISSION_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || !recommenderName.trim()}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
