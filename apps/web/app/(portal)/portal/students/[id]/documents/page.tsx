"use client";

import { Suspense, use, useState } from "react";
import { PortalStudentShell } from "@/components/portal/portal-student-shell";
import { usePortalDocuments } from "@/lib/portal/hooks";
import { requestPortalDocumentDownload } from "@/lib/portal/api";
import { resolveApiUrl } from "@/lib/api/client";
import { LoadingState, EmptyState } from "@/components/crm/query-states";
import {
  StatusBadge,
  DOCUMENT_STATUS_VARIANT,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_SCAN_STATUS_VARIANT,
  DOCUMENT_SCAN_STATUS_LABEL,
} from "@/components/crm/status-badge";
import { formatFileSize } from "@/lib/documents/file-validation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Exactly the caller's own `DocumentAccess` grants (`DocumentsService.listAccessibleTo`) —
/// never a scan by owner entity, never enumerable beyond that (F08 instruction §17/§18). No
/// raw storage path/bucket/R2 metadata is ever in this response to begin with.
export function DocumentsContent({ studentId }: { studentId: string }) {
  const { data: documents, isLoading } = usePortalDocuments(studentId);
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (!documents || documents.length === 0) return <EmptyState title="Chưa có tài liệu nào." />;

  async function handleDownload(documentId: string) {
    setDownloadingId(documentId);
    try {
      const { downloadUrl } = await requestPortalDocumentDownload(studentId, documentId);
      window.open(resolveApiUrl(downloadUrl), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <ul className="space-y-3">
      {documents.map((d) => (
        <li key={d.id}>
          <Card className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                {d.originalFilename ?? d.documentCode} · {formatFileSize(d.sizeBytes)}
              </p>
              <div className="mt-1 flex gap-1">
                <StatusBadge status={d.status} variantMap={DOCUMENT_STATUS_VARIANT} label={DOCUMENT_STATUS_LABEL[d.status]} />
                <StatusBadge status={d.scanStatus} variantMap={DOCUMENT_SCAN_STATUS_VARIANT} label={DOCUMENT_SCAN_STATUS_LABEL[d.scanStatus]} />
              </div>
            </div>
            {d.scanStatus === "CLEAN" ? (
              <Button variant="secondary" onClick={() => handleDownload(d.id)} disabled={downloadingId === d.id}>
                {downloadingId === d.id ? "Đang mở..." : "Tải xuống"}
              </Button>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function PortalDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PortalDocumentsPageInner params={params} />
    </Suspense>
  );
}

function PortalDocumentsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PortalStudentShell studentId={id}>
      <DocumentsContent studentId={id} />
    </PortalStudentShell>
  );
}
