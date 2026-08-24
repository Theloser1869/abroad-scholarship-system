"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { usePartner } from "@/lib/partners/hooks";
import { useCommissionRules, useCreateCommissionRule, useUpdateCommissionRule, useActivateCommissionRule, useDeactivateCommissionRule } from "@/lib/commission-rules/hooks";
import { CommissionRuleFormDialog } from "@/components/crm/commission-rules/commission-rule-form-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, MASTER_DATA_STATUS_VARIANT, MASTER_DATA_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";
import type { CommissionRule } from "@/lib/commission-rules/types";

const BASIS_LABEL: Record<string, string> = {
  CONTRACT_VALUE: "Giá trị hợp đồng",
  PAYMENT_COLLECTED: "Số tiền đã thu",
  FIXED: "Cố định",
};

/// Per-row component so activate/deactivate hooks stay at their own top level, never called
/// inline inside `.map()` (Rules-of-Hooks — same fix pattern F04/F05 established).
function CommissionRuleRow({ rule, canEdit }: { rule: CommissionRule; canEdit: boolean }) {
  const { toast } = useToast();
  const activateRule = useActivateCommissionRule(rule.id);
  const deactivateRule = useDeactivateCommissionRule(rule.id);
  const [editOpen, setEditOpen] = useState(false);
  const updateRule = useUpdateCommissionRule(rule.id);

  async function handleToggle() {
    try {
      if (rule.status === "ACTIVE") {
        await deactivateRule.mutateAsync();
        toast({ title: "Đã tạm ngưng quy tắc.", variant: "success" });
      } else {
        await activateRule.mutateAsync();
        toast({ title: "Đã kích hoạt quy tắc.", variant: "success" });
      }
    } catch (err) {
      toast({ title: "Lỗi", description: crmErrorMessage(err), variant: "danger" });
    }
  }

  return (
    <li className="space-y-1 rounded border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {BASIS_LABEL[rule.basis] ?? rule.basis}
          {rule.partnerProgramId ? <span className="ml-2 text-xs text-muted-foreground">Chương trình: {rule.partnerProgramId.slice(0, 8)}…</span> : <span className="ml-2 text-xs text-muted-foreground">Toàn bộ đối tác</span>}
        </span>
        <StatusBadge status={rule.status} variantMap={MASTER_DATA_STATUS_VARIANT} label={MASTER_DATA_STATUS_LABEL[rule.status]} />
      </div>
      <p className="text-sm text-muted-foreground">
        {rule.basis === "FIXED" ? <Money value={rule.fixedAmount} currency={rule.currency} /> : `${rule.percentageRate ? Number(rule.percentageRate) * 100 : "—"}%`}
        {" · Ưu tiên "}
        {rule.priority}
      </p>
      {rule.conditions ? <p className="text-xs text-muted-foreground">{rule.conditions}</p> : null}
      {canEdit ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Sửa
          </Button>
          <Button variant={rule.status === "ACTIVE" ? "danger" : "primary"} onClick={handleToggle} disabled={activateRule.isPending || deactivateRule.isPending}>
            {rule.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt"}
          </Button>
        </div>
      ) : null}
      <CommissionRuleFormDialog open={editOpen} onClose={() => setEditOpen(false)} rule={rule} onSubmit={(input) => updateRule.mutateAsync(input)} submitting={updateRule.isPending} />
    </li>
  );
}

export function PartnerCommissionRulesContent({ partnerId }: { partnerId: string }) {
  const { can } = usePermissions();
  const { data: partner } = usePartner(partnerId);
  const { data: rules, isLoading, error, refetch } = useCommissionRules(partnerId, { limit: 100 });
  const createRule = useCreateCommissionRule(partnerId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/partners/${partnerId}`} className="text-sm text-primary hover:underline">
          ← {partner?.name ?? "Đối tác"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Quy tắc hoa hồng</h1>
          {can("commission_rules", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Tạo quy tắc</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !rules || rules.data.length === 0 ? (
        <EmptyState title="Chưa có quy tắc hoa hồng nào." description="Tạo quy tắc để tính hoa hồng cho các giao dịch của đối tác này." />
      ) : (
        <ul className="space-y-2">
          {rules.data.map((r) => (
            <CommissionRuleRow key={r.id} rule={r} canEdit={can("commission_rules", "edit")} />
          ))}
        </ul>
      )}

      <CommissionRuleFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(input) => createRule.mutateAsync(input as Parameters<typeof createRule.mutateAsync>[0])} submitting={createRule.isPending} />
    </div>
  );
}

export default function PartnerCommissionRulesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PartnerCommissionRulesPageInner params={params} />
    </Suspense>
  );
}

function PartnerCommissionRulesPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: partnerId } = use(params);
  return (
    <RequirePermission resource="commission_rules" action="view">
      <PartnerCommissionRulesContent partnerId={partnerId} />
    </RequirePermission>
  );
}
