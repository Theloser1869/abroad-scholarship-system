import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Offer } from "@/lib/offers/types";
import { OfferDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const offersApi = vi.hoisted(() => ({ listOffersForApplication: vi.fn(), getCurrentOffer: vi.fn(), getOffer: vi.fn(), createOffer: vi.fn(), respondToOffer: vi.fn() }));
vi.mock("@/lib/offers/api", () => offersApi);

const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    applicationId: "app-1",
    offerType: "Unconditional",
    offerDate: "2026-02-01T00:00:00.000Z",
    acceptanceDeadline: "2026-03-01T00:00:00.000Z",
    depositAmount: null,
    depositCurrency: null,
    isConditional: false,
    conditions: null,
    status: "RECEIVED",
    respondedAt: null,
    evidenceDocumentId: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("OfferDetailContent (accept/decline, idempotency)", () => {
  it("shows the forbidden state for a role without offers:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="offers" action="view">
        <OfferDetailContent id="offer-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(offersApi.getOffer).not.toHaveBeenCalled();
  });

  it("accepts a RECEIVED offer via the dedicated respond action", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    offersApi.getOffer.mockResolvedValue(makeOffer({ status: "RECEIVED" }));
    offersApi.respondToOffer.mockResolvedValue(makeOffer({ status: "ACCEPTED", respondedAt: "2026-02-10T00:00:00.000Z" }));

    renderWithProviders(<OfferDetailContent id="offer-1" />);
    await screen.findByText("Unconditional");

    await userEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));
    // The dialog's own confirm button shares the header action button's label.
    const confirmButtons = await screen.findAllByRole("button", { name: "Chấp nhận" });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(offersApi.respondToOffer).toHaveBeenCalledWith("offer-1", { decision: "ACCEPT" }));
  });

  it("hides Chấp nhận/Từ chối once already resolved (ACCEPTED) — no repeat-response action offered", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    offersApi.getOffer.mockResolvedValue(makeOffer({ status: "ACCEPTED", respondedAt: "2026-02-05T00:00:00.000Z" }));

    renderWithProviders(<OfferDetailContent id="offer-1" />);
    await screen.findByText("Unconditional");

    expect(screen.queryByRole("button", { name: "Chấp nhận" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("a raced second respond surfaces the real 409 INVALID_OFFER_STATE as an error, never a silent success", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    offersApi.getOffer.mockResolvedValue(makeOffer({ status: "RECEIVED" }));
    offersApi.respondToOffer.mockRejectedValue(
      new ApiError(409, { error: { code: "INVALID_OFFER_STATE", message: "This offer is ACCEPTED and can no longer be responded to.", requestId: "r1" } }),
    );

    renderWithProviders(<OfferDetailContent id="offer-1" />);
    await screen.findByText("Unconditional");

    await userEvent.click(screen.getByRole("button", { name: "Chấp nhận" }));
    const confirmButtons2 = await screen.findAllByRole("button", { name: "Chấp nhận" });
    await userEvent.click(confirmButtons2[confirmButtons2.length - 1]);

    expect(await screen.findByText(/đã được phản hồi/)).toBeInTheDocument();
  });
});
