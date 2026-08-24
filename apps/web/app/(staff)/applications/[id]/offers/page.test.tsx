import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { Offer } from "@/lib/offers/types";
import { ApplicationOffersContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const offersApi = vi.hoisted(() => ({ listOffersForApplication: vi.fn(), getCurrentOffer: vi.fn(), getOffer: vi.fn(), createOffer: vi.fn(), respondToOffer: vi.fn() }));
vi.mock("@/lib/offers/api", () => offersApi);
const applicationsApi = vi.hoisted(() => ({ getApplication: vi.fn() }));
vi.mock("@/lib/applications/api", () => applicationsApi);

beforeEach(() => {
  vi.resetAllMocks();
  applicationsApi.getApplication.mockResolvedValue({ id: "app-1", applicationCode: "APP-2026-00001" });
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

describe("ApplicationOffersContent (multiple offers, current offer)", () => {
  it("shows the forbidden state for a role without offers:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="offers" action="view">
        <ApplicationOffersContent applicationId="app-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(offersApi.listOffersForApplication).not.toHaveBeenCalled();
  });

  it("keeps full offer history — multiple offers all remain visible, never overwritten", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    const older = makeOffer({ id: "offer-old", offerType: "Conditional", status: "DECLINED" });
    const current = makeOffer({ id: "offer-1", offerType: "Unconditional", status: "RECEIVED" });
    offersApi.listOffersForApplication.mockResolvedValue([current, older]);
    offersApi.getCurrentOffer.mockResolvedValue(current);

    renderWithProviders(<ApplicationOffersContent applicationId="app-1" />);

    expect((await screen.findAllByText("Unconditional")).length).toBeGreaterThan(0);
    expect(screen.getByText("Conditional")).toBeInTheDocument();
    expect(screen.getByText("Hiện tại")).toBeInTheDocument();
  });

  it("shows the empty state when there are no offers yet", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    offersApi.listOffersForApplication.mockResolvedValue([]);
    offersApi.getCurrentOffer.mockResolvedValue(null);

    renderWithProviders(<ApplicationOffersContent applicationId="app-1" />);

    expect(await screen.findByText("Chưa có thư mời nào.")).toBeInTheDocument();
  });

  it("creates a new Offer without touching any existing offer's row", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    offersApi.listOffersForApplication.mockResolvedValue([]);
    offersApi.getCurrentOffer.mockResolvedValue(null);
    offersApi.createOffer.mockResolvedValue(makeOffer());

    renderWithProviders(<ApplicationOffersContent applicationId="app-1" />);
    await screen.findByText("Chưa có thư mời nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Ghi nhận thư mời" }));
    await userEvent.type(screen.getByLabelText("Loại thư mời *"), "Deferred");
    await userEvent.click(screen.getByRole("button", { name: "Ghi nhận thư mời" }));

    await waitFor(() => expect(offersApi.createOffer).toHaveBeenCalledWith("app-1", expect.objectContaining({ offerType: "Deferred" })));
  });
});
