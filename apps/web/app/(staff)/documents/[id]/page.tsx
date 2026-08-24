"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useDocument, useUpdateDocument, useShareDocument, useArchiveDocument, useCreateDocumentVersion } from "@/lib/documents/hooks";
import { DocumentEditDialog } from "@/components/crm/documents/document-edit-dialog";
import { DocumentShareDialog } from "@/components/crm/documents/document-share-dialog";
import { DocumentVersionDialog } from "@/components/crm/documents/document-version-dialog";
import { ConfirmDialog } from "@/components/crm/confirm-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { formatFileSize } from "@/lib/documents/file-validation";
import { StatusBadge, DOCUMENT_STATUS_VARIANT, DOCUMENT_STATUS_LABEL, DOCUMENT_SCAN_STATUS_VARIANT, DOCUMENT_SCAN_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import { useRouter } from "next/navigation";

/// Document workspace (F07 instruction §7/§13/§14) — reached only by a known id (no bare
/// list route exists). Download is delegated entirely to the existing `EvidenceDocumentLink`
/// 2-step signed-URL flow (F04) rather than re-implemented here, per the mega-prompt's "không
/// redesign... common UI primitives" F06-gate rule.
export function DocumentDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();
  const { data: document, isLoading, error, refetch } = useDocument(id);

  const updateDocument = useUpdateDocument(id);
  const shareDocument = useShareDocument(id);
  const archiveDocument = useArchiveDocument(id);
  const createVersion = useCreateDocumentVersion(id);

  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !document) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const isArchived = document.status === "ARCHIVED";
  const canEdit = can("documents", "edit") && !isArchived;
  const canShare = can("documents", "share");
  const canArchive = can("documents", "archive") && !isArchived;
  const canDownload = can("documents", "download");

  async function handleArchive() {
    try {
      await archiveDocument.mutateAsync();
      toast({ title: "Đã lưu trữ tài liệu.", variant: "success" });
      setArchiveOpen(false);
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{document.documentCode}</p>
          <h1 className="mt-1 text-xl font-semibold">{document.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={document.status} variantMap={DOCUMENT_STATUS_VARIANT} label={DOCUMENT_STATUS_LABEL[document.status]} />
          <StatusBadge status={document.scanStatus} variantMap={DOCUMENT_SCAN_STATUS_VARIANT} label={DOCUMENT_SCAN_STATUS_LABEL[document.scanStatus]} />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">v{document.version}</span>
        </div>
      </div>

      {document.scanStatus === "PENDING" ? (
        <div role="status" className="rounded border border-warning/40 bg-warning/5 p-3 text-sm">
          Tài liệu đang được quét virus — chưa thể tải xuống. Vui lòng thử lại sau ít phút.
        </div>
      ) : document.scanStatus !== "CLEAN" ? (
        <div role="alert" className="rounded border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          Tài liệu không thể tải xuống (trạng thái quét: {DOCUMENT_SCAN_STATUS_LABEL[document.scanStatus]}).
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canDownload && document.scanStatus === "CLEAN" ? <EvidenceDocumentLink documentId={document.id} /> : null}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Sửa
          </Button>
        ) : null}
        {canShare ? (
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            Chia sẻ
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="secondary" onClick={() => setVersionOpen(true)}>
            Tạo phiên bản mới
          </Button>
        ) : null}
        {canArchive ? (
          <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={archiveDocument.isPending}>
            Lưu trữ
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài liệu</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <Row label="Loại tài liệu" value={document.documentType} />
          <Row label="Ngữ cảnh" value={`${document.ownerEntity} · ${document.ownerId}`} />
          <Row label="Tên tệp gốc" value={document.originalFilename ?? "—"} />
          <Row label="Loại MIME" value={document.mimeType ?? "—"} />
          <Row label="Kích thước" value={formatFileSize(document.sizeBytes)} />
          <Row
            label="Checksum SHA-256"
            value={document.checksumSha256 ? `${document.checksumSha256.slice(0, 16)}… (đã tính)` : "Chưa có"}
          />
          <Row label="Người tải lên" value={document.uploadedById} />
          <Row label="Ngày tải lên" value={new Date(document.uploadedAt).toLocaleString("vi-VN")} />
          {document.retentionUntil ? <Row label="Lưu giữ đến" value={new Date(document.retentionUntil).toLocaleDateString("vi-VN")} /> : null}
          {document.legalHold ? <Row label="Giữ theo yêu cầu pháp lý" value="Có" /> : null}
          {document.archivedAt ? <Row label="Ngày lưu trữ" value={new Date(document.archivedAt).toLocaleString("vi-VN")} /> : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Phiên bản trước</dt>
            <dd>
              {document.previousVersionId ? (
                <Link href={`/documents/${document.previousVersionId}`} className="text-primary underline-offset-2 hover:underline">
                  Xem phiên bản trước
                </Link>
              ) : (
                "Đây là phiên bản đầu tiên"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <DocumentEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        document={document}
        onSubmit={(input) => updateDocument.mutateAsync(input)}
        submitting={updateDocument.isPending}
      />
      <DocumentShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSubmit={(input) => shareDocument.mutateAsync(input)}
        submitting={shareDocument.isPending}
      />
      <DocumentVersionDialog
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onSubmit={async (file) => {
          const result = await createVersion.mutateAsync(file);
          router.push(`/documents/${result.id}`);
          return result;
        }}
        submitting={createVersion.isPending}
      />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Lưu trữ tài liệu"
        description="Sau khi lưu trữ sẽ không thể chỉnh sửa hoặc tạo phiên bản mới."
        confirmLabel="Lưu trữ"
        variant="danger"
        onConfirm={handleArchive}
        submitting={archiveDocument.isPending}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <DocumentDetailPageInner params={params} />
    </Suspense>
  );
}

function DocumentDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="documents" action="view">
      <DocumentDetailContent id={id} />
    </RequirePermission>
  );
}
