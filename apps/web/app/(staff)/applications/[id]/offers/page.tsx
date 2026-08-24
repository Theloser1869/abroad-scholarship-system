"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useApplication } from "@/lib/applications/hooks";
import { useOffersForApplication, useCurrentOffer, useCreateOffer } from "@/lib/offers/hooks";
import { OfferCreateDialog } from "@/components/crm/offers/offer-create-dialog";
import { Money } from "@/components/crm/money";
import { StatusBadge, OFFER_STATUS_VARIANT, OFFER_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, EmptyState, QueryErrorState } from "@/components/crm/query-states";
import { Button } from "@/components/ui/button";

/// Offer history for one Application (F05 instruction §18/§20) — full history always kept,
/// never overwritten; the current offer (backend-computed, never derived from "latest
/// date") is highlighted but every other offer stays visible with its own real status.
export function ApplicationOffersContent({ applicationId }: { applicationId: string }) {
  const { can } = usePermissions();
  const { data: application } = useApplication(applicationId);
  const { data: offers, isLoading, error, refetch } = useOffersForApplication(applicationId);
  const { data: currentOffer } = useCurrentOffer(applicationId);
  const createOffer = useCreateOffer(applicationId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/applications/${applicationId}`} className="text-sm text-primary hover:underline">
          ← {application?.applicationCode ?? "Hồ sơ ứng tuyển"}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Thư mời nhập học</h1>
          {can("offers", "create") ? <Button onClick={() => setCreateOpen(true)}>+ Ghi nhận thư mời</Button> : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <QueryErrorState error={error} onRetry={() => refetch()} />
      ) : !offers || offers.length === 0 ? (
        <EmptyState title="Chưa có thư mời nào." description="Ghi nhận thư mời khi hồ sơ nhận được kết quả." />
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li key={o.id} className={`rounded border p-3 ${currentOffer?.id === o.id ? "border-primary" : "border-border"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/offers/${o.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                  {o.offerType}
                </Link>
                <div className="flex items-center gap-2">
                  {currentOffer?.id === o.id ? <span className="text-xs font-medium text-primary">Hiện tại</span> : null}
                  <StatusBadge status={o.status} variantMap={OFFER_STATUS_VARIANT} label={OFFER_STATUS_LABEL[o.status]} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {o.offerDate ? `Nhận ngày ${new Date(o.offerDate).toLocaleDateString("vi-VN")}` : ""}
                {o.acceptanceDeadline ? ` · Hạn phản hồi ${new Date(o.acceptanceDeadline).toLocaleDateString("vi-VN")}` : ""}
              </p>
              {o.depositAmount ? (
                <p className="text-xs text-muted-foreground">
                  Đặt cọc: <Money value={o.depositAmount} currency={o.depositCurrency} />
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <OfferCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createOffer.mutateAsync(input)}
        submitting={createOffer.isPending}
      />
    </div>
  );
}

// F09 fix — this route folder was `[applicationId]/offers`, a sibling of `../[id]`'s own
// detail page at the SAME path position. Next.js requires every dynamic segment sharing a
// position to use the identical slug name; two different names there is a genuine routing
// configuration error that `next build` never caught (it only surfaced running `next dev`,
// which no prior phase had actually done — F09 instruction §36's browser-testing pass is
// what found it). Folder renamed to `[id]` to match; the param is still called
// `applicationId` internally once destructured, since that's what it actually identifies.
export default function ApplicationOffersPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ApplicationOffersPageInner params={params} />
    </Suspense>
  );
}

function ApplicationOffersPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = use(params);
  return (
    <RequirePermission resource="offers" action="view">
      <ApplicationOffersContent applicationId={applicationId} />
    </RequirePermission>
  );
}
