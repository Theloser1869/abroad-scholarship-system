import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { PreDepartureItem } from "@/lib/pre-departure/types";
import { CasePreDepartureContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const preDepartureApi = vi.hoisted(() => ({ listPreDepartureItems: vi.fn(), createPreDepartureItem: vi.fn(), updatePreDepartureItem: vi.fn() }));
vi.mock("@/lib/pre-departure/api", () => preDepartureApi);
const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "CASE-2026-00001" });
});

function makeItem(overrides: Partial<PreDepartureItem> = {}): PreDepartureItem {
  return {
    id: "pdi-1",
    entityType: "PreDeparture",
    entityId: "case-1",
    title: "Mua vé máy bay",
    category: "Vé máy bay",
    required: true,
    ownerId: null,
    deadline: null,
    status: "PENDING",
    documentId: null,
    notes: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CasePreDepartureContent (identical VisaChecklistItem model, entityType=PreDeparture — no separate PreDeparture record)", () => {
  it("shows the forbidden state for a role without pre_departure:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="pre_departure" action="view">
        <CasePreDepartureContent caseId="case-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(preDepartureApi.listPreDepartureItems).not.toHaveBeenCalled();
  });

  it("renders items with a server-reported progress count, never a client-computed 'complete' flag", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    preDepartureApi.listPreDepartureItems.mockResolvedValue([makeItem({ status: "DONE" }), makeItem({ id: "pdi-2", title: "Bảo hiểm du học", status: "PENDING" })]);

    renderWithProviders(<CasePreDepartureContent caseId="case-1" />);

    expect(await screen.findByText("Mua vé máy bay")).toBeInTheDocument();
    expect(screen.getByText("Bảo hiểm du học")).toBeInTheDocument();
    expect(screen.getByText("1/2 hạng mục đã hoàn tất hoặc miễn trừ")).toBeInTheDocument();
  });

  it("creates a pre-departure item with a free-text category", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    preDepartureApi.listPreDepartureItems.mockResolvedValue([]);
    preDepartureApi.createPreDepartureItem.mockResolvedValue(makeItem());

    renderWithProviders(<CasePreDepartureContent caseId="case-1" />);
    await screen.findByText("Chưa có hạng mục chuẩn bị nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Hạng mục" }));
    await userEvent.type(screen.getByLabelText("Tên hạng mục *"), "Xin visa nhập cảnh");
    await userEvent.type(screen.getByLabelText("Nhóm"), "Visa");
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));

    await waitFor(() => expect(preDepartureApi.createPreDepartureItem).toHaveBeenCalledWith("case-1", expect.objectContaining({ title: "Xin visa nhập cảnh", category: "Visa" })));
  });

  it("STUDENT_PARENT (own case) has no edit action, sees items read-only", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    preDepartureApi.listPreDepartureItems.mockResolvedValue([makeItem()]);

    renderWithProviders(<CasePreDepartureContent caseId="case-1" />);
    await screen.findByText("Mua vé máy bay");

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Hạng mục" })).not.toBeInTheDocument();
  });
});
