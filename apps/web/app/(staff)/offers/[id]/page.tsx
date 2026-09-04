"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/shell/require-permission";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useOffer, useRespondToOffer } from "@/lib/offers/hooks";
import { OfferRespondDialog } from "@/components/crm/offers/offer-respond-dialog";
import { EvidenceDocumentLink } from "@/components/crm/evidence-document-link";
import { Money } from "@/components/crm/money";
import { StatusBadge, OFFER_STATUS_VARIANT, OFFER_STATUS_LABEL } from "@/components/crm/status-badge";
import { LoadingState, QueryErrorState } from "@/components/crm/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OfferDecision } from "@/lib/offers/types";
import { useBreadcrumbLabel } from "@/components/shell/breadcrumb-labels";

export function OfferDetailContent({ id }: { id: string }) {
  const { can } = usePermissions();
  const { data: offer, isLoading, error, refetch } = useOffer(id);
  useBreadcrumbLabel(id, offer?.offerType);
  const respondToOffer = useRespondToOffer(id, offer?.applicationId ?? "");
  const [respondDecision, setRespondDecision] = useState<OfferDecision | null>(null);

  if (isLoading) return <LoadingState />;
  if (error || !offer) return <QueryErrorState error={error} onRetry={() => refetch()} />;

  const canRespond = offer.status === "RECEIVED" && can("offers", "edit");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/applications/${offer.applicationId}/offers`} className="text-sm text-primary hover:underline">
            ← Danh sách thư mời
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{offer.offerType}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={offer.status} variantMap={OFFER_STATUS_VARIANT} label={OFFER_STATUS_LABEL[offer.status]} />
          {canRespond ? (
            <>
              <Button variant="primary" onClick={() => setRespondDecision("ACCEPT")}>
                Chấp nhận
              </Button>
              <Button variant="danger" onClick={() => setRespondDecision("DECLINE")}>
                Từ chối
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin thư mời</CardTitle>
        </CardHeader>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ngày nhận thư</dt>
            <dd>{offer.offerDate ? new Date(offer.offerDate).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Hạn phản hồi</dt>
            <dd>{offer.acceptanceDeadline ? new Date(offer.acceptanceDeadline).toLocaleDateString("vi-VN") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Điều kiện</dt>
            <dd>{offer.isConditional ? "Có điều kiện" : "Không điều kiện"}</dd>
          </div>
          {offer.depositAmount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiền đặt cọc</dt>
              <dd>
                <Money value={offer.depositAmount} currency={offer.depositCurrency} />
              </dd>
            </div>
          ) : null}
          {offer.respondedAt ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Đã phản hồi lúc</dt>
              <dd>{new Date(offer.respondedAt).toLocaleString("vi-VN")}</dd>
            </div>
          ) : null}
        </dl>
        {offer.conditions ? (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="font-medium">Chi tiết điều kiện</p>
            <p className="text-muted-foreground">{offer.conditions}</p>
          </div>
        ) : null}
        {offer.evidenceDocumentId ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium">Tài liệu thư mời</p>
            <EvidenceDocumentLink documentId={offer.evidenceDocumentId} />
          </div>
        ) : null}
      </Card>

      <OfferRespondDialog
        open={respondDecision !== null}
        onClose={() => setRespondDecision(null)}
        decision={respondDecision ?? "ACCEPT"}
        onSubmit={(decision) => respondToOffer.mutateAsync({ decision })}
        submitting={respondToOffer.isPending}
      />
    </div>
  );
}

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <OfferDetailPageInner params={params} />
    </Suspense>
  );
}

function OfferDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission resource="offers" action="view">
      <OfferDetailContent id={id} />
    </RequirePermission>
  );
}
