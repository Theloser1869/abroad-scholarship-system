import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import DocumentsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DocumentsPage (hub) — deliberately not a browser, F07 §6: no global list route on the backend", () => {
  it("shows the forbidden state for a role without documents:view", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(<DocumentsPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
  });

  it("navigates to the entered document id, and shows the upload entry point", async () => {
    authState.principal = { userId: "u1", roleCode: "DOCUMENT_SPECIALIST" };
    const user = userEvent.setup();
    renderWithProviders(<DocumentsPage />);

    await user.type(screen.getByLabelText("Document ID"), "doc-123");
    await user.click(screen.getByRole("button", { name: "Xem" }));

    expect(pushMock).toHaveBeenCalledWith("/documents/doc-123");
    expect(screen.getByRole("button", { name: "+ Tải lên tài liệu" })).toBeInTheDocument();
  });
});
