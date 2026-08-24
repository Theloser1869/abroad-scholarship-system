"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/// There is no bare `GET /documents` list on the backend (`DocumentsController` has no list
/// route) — F07 instruction §6: "Không tạo global document browser nếu backend không có
/// global list route." This hub is deliberately NOT a browser: it is two real entry points
/// only — (1) look up a document you already know the id of (reached from a Case/Application/
/// Visa/... evidence link elsewhere in the app, or communicated out-of-band), and (2) upload
/// a new one. Documented as ASM in docs/frontend/phase-status/PHASE_F07.md.
function DocumentsHub() {
  const { can } = usePermissions();
  const router = useRouter();
  const [lookupId, setLookupId] = useState("");

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (lookupId.trim()) router.push(`/documents/${lookupId.trim()}`);
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Tài liệu</h1>
      <p className="text-sm text-muted-foreground">
        Hệ thống không có danh sách tài liệu toàn cục — tài liệu được truy cập theo ngữ cảnh (từ trang case, hồ sơ ứng
        tuyển, visa, đối tác...) hoặc theo mã tài liệu đã biết.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Tra cứu theo ID</CardTitle>
        </CardHeader>
        <form onSubmit={handleLookup} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="document-lookup-id" className="mb-1 block text-sm font-medium">
              Document ID
            </label>
            <Input id="document-lookup-id" value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="UUID tài liệu" />
          </div>
          <Button type="submit" disabled={!lookupId.trim()}>
            Xem
          </Button>
        </form>
      </Card>

      {can("documents", "create") ? (
        <Card>
          <CardHeader>
            <CardTitle>Tải lên tài liệu mới</CardTitle>
          </CardHeader>
          <Link href="/documents/upload">
            <Button type="button">+ Tải lên tài liệu</Button>
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <RequirePermission resource="documents" action="view">
      <DocumentsHub />
    </RequirePermission>
  );
}
