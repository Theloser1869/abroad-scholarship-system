"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/shell/require-permission";
import { useUploadDocument } from "@/lib/documents/hooks";
import { ALLOWED_DOCUMENT_ACCEPT, validateFileClientSide } from "@/lib/documents/file-validation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Common owner-entity type names used elsewhere in this codebase (Case-scoped domains'
/// evidence fields, Partner documents, ...) — a UX suggestion list only. `ownerEntity` is a
/// free-text string on the backend (`UploadDocumentDto`, max 100 chars), never a closed enum,
/// so the field stays freely editable (`list=` datalist, not a `<select>`).
const OWNER_ENTITY_SUGGESTIONS = ["Case", "Student", "Contract", "Application", "ScholarshipApplication", "Visa", "Enrollment", "Partner"];

/// Generic upload entry point (F07 instruction §8) — there is no per-entity "Upload"
/// button embedded in every existing Case/Application/Visa/... page yet (that would touch
/// every F03-F06 page; out of this phase's minimal-diff scope per the F06 gate), so this one
/// page, reached from the Documents hub, covers every owner-entity context by letting the
/// caller name it directly — the same manual-linkage-field precedent already established by
/// `CommissionTransaction`/`Enrollment`'s manual UUID fields (F06).
function DocumentUploadForm() {
  const router = useRouter();
  const { toast } = useToast();
  const uploadDocument = useUploadDocument();

  const [ownerEntity, setOwnerEntity] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownerEntityId = useId();
  const ownerIdId = useId();
  const documentTypeId = useId();
  const titleId = useId();
  const datalistId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const clientError = validateFileClientSide(file);
    if (clientError) {
      setError(clientError);
      return;
    }
    setError(null);
    try {
      const result = await uploadDocument.mutateAsync({ input: { ownerEntity, ownerId, documentType, title }, file });
      toast({ title: "Đã tải lên tài liệu.", variant: "success" });
      if (result.duplicateOfId) {
        toast({
          title: "Lưu ý: có thể trùng lặp",
          description: `Đã tồn tại tài liệu khác cùng nội dung cho ngữ cảnh này (mã: ${result.duplicateOfId}). Tài liệu mới vẫn được tạo — đây chỉ là thông tin tham khảo.`,
        });
      }
      router.push(`/documents/${result.id}`);
    } catch (err) {
      setError(crmErrorMessage(err));
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Link href="/documents" className="text-sm text-primary hover:underline">
          ← Tài liệu
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Tải lên tài liệu mới</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài liệu</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor={ownerEntityId} className="mb-1 block text-sm font-medium">
              Ngữ cảnh (loại đối tượng sở hữu)
            </label>
            <Input
              id={ownerEntityId}
              list={datalistId}
              value={ownerEntity}
              onChange={(e) => setOwnerEntity(e.target.value)}
              maxLength={100}
              placeholder="Ví dụ: Case, Student, Application..."
              required
            />
            <datalist id={datalistId}>
              {OWNER_ENTITY_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor={ownerIdId} className="mb-1 block text-sm font-medium">
              ID đối tượng sở hữu
            </label>
            <Input id={ownerIdId} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="UUID" required />
          </div>
          <div>
            <label htmlFor={documentTypeId} className="mb-1 block text-sm font-medium">
              Loại tài liệu
            </label>
            <Input
              id={documentTypeId}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              maxLength={100}
              placeholder="Ví dụ: PASSPORT, TRANSCRIPT, CONTRACT_SIGNED..."
              required
            />
          </div>
          <div>
            <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
              Tiêu đề
            </label>
            <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tệp</label>
            <input
              type="file"
              accept={ALLOWED_DOCUMENT_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Định dạng cho phép: PDF, JPG, PNG, DOC(X), XLS(X), PPT(X), ZIP, TXT — tối đa 25MB. Máy chủ sẽ kiểm tra lại toàn bộ.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={uploadDocument.isPending || !file}>
              {uploadDocument.isPending ? "Đang tải lên..." : "Tải lên"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function DocumentUploadPage() {
  return (
    <RequirePermission resource="documents" action="create">
      <DocumentUploadForm />
    </RequirePermission>
  );
}
