"use client";

import { useState } from "react";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useAddWritingVersionComment, useReviewWritingVersion, useWritingVersionComments } from "@/lib/writing/hooks";
import type { WritingVersion } from "@/lib/writing/types";
import { NoteForm } from "@/components/crm/note-form";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

const REVIEW_LABEL: Record<string, string> = { PENDING: "Chưa xét duyệt", APPROVED: "Đã duyệt", CHANGES_REQUESTED: "Cần chỉnh sửa" };

/// One version, one row — comments/review live here (not the parent list) so
/// `useWritingVersionComments`/`useReviewWritingVersion` (both hooks) are called at this
/// component's own top level, never inside a `.map()` callback (Rules of Hooks).
export function WritingVersionRow({ version, artifactId }: { version: WritingVersion; artifactId: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);
  const { data: comments, isLoading, error } = useWritingVersionComments(showComments ? version.id : undefined);
  const review = useReviewWritingVersion(version.id, artifactId);
  const addComment = useAddWritingVersionComment(version.id);

  async function handleReview(reviewStatus: "APPROVED" | "CHANGES_REQUESTED") {
    try {
      await review.mutateAsync(reviewStatus);
      toast({ title: "Đã ghi nhận đánh giá phiên bản.", variant: "success" });
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">Phiên bản {version.versionNumber}</p>
          {version.changeSummary ? <p className="text-xs text-muted-foreground">{version.changeSummary}</p> : null}
          <p className="text-xs text-muted-foreground">{REVIEW_LABEL[version.reviewStatus] ?? version.reviewStatus}</p>
        </div>
        {version.documentId ? <EvidenceDocumentLink documentId={version.documentId} /> : null}
      </div>
      {version.content ? <p className="mt-2 whitespace-pre-wrap text-sm">{version.content}</p> : null}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {can("writing", "edit") ? (
          <>
            <button type="button" className="text-primary hover:underline" disabled={review.isPending} onClick={() => handleReview("APPROVED")}>
              Duyệt phiên bản
            </button>
            <button type="button" className="text-primary hover:underline" disabled={review.isPending} onClick={() => handleReview("CHANGES_REQUESTED")}>
              Yêu cầu chỉnh sửa
            </button>
          </>
        ) : null}
        <button type="button" className="text-primary hover:underline" onClick={() => setShowComments((v) => !v)}>
          {showComments ? "Ẩn bình luận" : "Xem bình luận"}
        </button>
      </div>
      {showComments ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {isLoading ? (
            <LoadingState rows={2} />
          ) : error ? (
            <QueryErrorState error={error} />
          ) : !comments || comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có bình luận nào.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {comments.map((c) => (
                <li key={c.id} className="border-b border-border pb-2 last:border-0">
                  <p>{c.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.visibility === "shared" ? "Hiển thị cho học sinh/phụ huynh" : "Nội bộ"} · {new Date(c.createdAt).toLocaleString("vi-VN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {can("writing", "edit") ? <NoteForm onSubmit={(input) => addComment.mutateAsync(input)} /> : null}
        </div>
      ) : null}
    </li>
  );
}
