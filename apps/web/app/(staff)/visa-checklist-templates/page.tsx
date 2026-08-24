"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useVisaChecklistTemplates, useCreateVisaChecklistTemplate, useUpdateVisaChecklistTemplate } from "@/lib/visa-checklist-templates/hooks";
import type { VisaChecklistTemplate, VisaChecklistTemplateListParams } from "@/lib/visa-checklist-templates/types";
import { VisaChecklistTemplateFormDialog } from "@/components/crm/visa-checklist-templates/visa-checklist-template-form-dialog";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { PaginationControls } from "@/components/crm/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";

/// GLOBAL master/config data (F06 instruction §17-shaped) — matching active templates are
/// instantiated into real VisaChecklistItem rows when a Visa is created; this catalog is
/// never directly attached. No `verify` action exists for this entity (a real difference
/// from University/Program/ScholarshipMaster). No standalone detail route — create/edit is
/// a Dialog.
function VisaChecklistTemplatesListPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VisaChecklistTemplate | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedCountry = useDebouncedValue(countryCode);

  const params: VisaChecklistTemplateListParams = {
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedCountry ? { countryCode: debouncedCountry } : {}),
  };

  const { data, isLoading, error, refetch } = useVisaChecklistTemplates(params);
  const createTemplate = useCreateVisaChecklistTemplate();
  const updateTemplate = useUpdateVisaChecklistTemplate(editTarget?.id ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mẫu checklist visa</h1>
        {can("visa_checklist_templates", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo mẫu</Button> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            placeholder="Tìm theo tên hạng mục..."
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            aria-label="Tìm kiếm mẫu checklist"
          />
        </div>
        <div className="w-32">
          <Input
            placeholder="Mã quốc gia"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value.toUpperCase());
              setPage(1);
            }}
            maxLength={2}
            aria-label="Lọc theo mã quốc gia"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Không có mẫu checklist nào." description="Thử điều chỉnh bộ lọc hoặc tạo mẫu mới." />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Quốc gia</TableHeaderCell>
                <TableHeaderCell>Loại visa</TableHeaderCell>
                <TableHeaderCell>Tên hạng mục</TableHeaderCell>
                <TableHeaderCell>Bắt buộc</TableHeaderCell>
                <TableHeaderCell>Đang áp dụng</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.countryCode}</TableCell>
                  <TableCell>{t.visaType}</TableCell>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>{t.required ? "Có" : "Không"}</TableCell>
                  <TableCell>{t.active ? "Có" : "Không"}</TableCell>
                  <TableCell>
                    {can("visa_checklist_templates", "edit") ? (
                      <Button variant="secondary" onClick={() => setEditTarget(t)}>
                        Sửa
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls meta={data.meta} onPageChange={setPage} />
        </>
      )}

      <VisaChecklistTemplateFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createTemplate.mutateAsync(input as Parameters<typeof createTemplate.mutateAsync>[0])}
        submitting={createTemplate.isPending}
      />
      <VisaChecklistTemplateFormDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        template={editTarget ?? undefined}
        onSubmit={(input) => updateTemplate.mutateAsync(input)}
        submitting={updateTemplate.isPending}
      />
    </div>
  );
}

export default function VisaChecklistTemplatesPage() {
  return (
    <RequirePermission resource="visa_checklist_templates" action="view">
      <VisaChecklistTemplatesListPage />
    </RequirePermission>
  );
}
