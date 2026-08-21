"use client";

import { useState } from "react";
import { resolveApiUrl } from "@/lib/api/client";
import { requestDocumentDownload } from "@/lib/documents/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Renders an `evidenceDocumentId`/`documentId` reference as a button that redeems the
/// existing 2-step signed-download flow (F04 instruction §31: "documents đi qua existing
/// signed access flow... không direct R2 access"). Never fetches or caches the file itself —
/// each click requests a fresh short-lived URL and opens it in a new tab immediately.
export function EvidenceDocumentLink({ documentId }: { documentId: string | null | undefined }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!documentId) {
    return <span className="text-sm text-muted-foreground">Chưa có tài liệu đính kèm</span>;
  }

  async function handleClick() {
    setLoading(true);
    try {
      const { downloadUrl } = await requestDocumentDownload(documentId as string);
      window.open(resolveApiUrl(downloadUrl), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} disabled={loading}>
      {loading ? "Đang mở..." : "Xem tài liệu"}
    </Button>
  );
}
