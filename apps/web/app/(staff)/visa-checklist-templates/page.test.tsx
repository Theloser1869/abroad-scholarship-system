import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { VisaChecklistTemplate } from "@/lib/visa-checklist-templates/types";
import VisaChecklistTemplatesPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const templatesApi = vi.hoisted(() => ({
  listVisaChecklistTemplates: vi.fn(),
  createVisaChecklistTemplate: vi.fn(),
  updateVisaChecklistTemplate: vi.fn(),
}));
vi.mock("@/lib/visa-checklist-templates/api", () => templatesApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeTemplate(overrides: Partial<VisaChecklistTemplate> = {}): VisaChecklistTemplate {
  return {
    id: "vct-1",
    countryCode: "US",
    visaType: "Student",
    title: "Hộ chiếu còn hạn",
    required: true,
    sortOrder: 1,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("VisaChecklistTemplatesPage (GLOBAL master data, distinct from a Visa's own checklist instance)", () => {
  it("shows the forbidden state for a role without visa_checklist_templates:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(<VisaChecklistTemplatesPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(templatesApi.listVisaChecklistTemplates).not.toHaveBeenCalled();
  });

  it("renders the template catalog", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    templatesApi.listVisaChecklistTemplates.mockResolvedValue({ data: [makeTemplate()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<VisaChecklistTemplatesPage />);

    expect(await screen.findByText("Hộ chiếu còn hạn")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
  });

  it("creates a template via the dialog", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    templatesApi.listVisaChecklistTemplates.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    templatesApi.createVisaChecklistTemplate.mockResolvedValue(makeTemplate());

    renderWithProviders(<VisaChecklistTemplatesPage />);
    await screen.findByText("Không có mẫu checklist nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo mẫu" }));
    await userEvent.type(screen.getAllByLabelText("Mã quốc gia (ISO-2) *")[0], "us");
    await userEvent.type(screen.getAllByLabelText("Loại visa *")[0], "Student");
    await userEvent.type(screen.getAllByLabelText("Tên hạng mục *")[0], "Vé máy bay khứ hồi");
    await userEvent.click(screen.getAllByRole("button", { name: "Tạo mẫu" })[0]);

    await waitFor(() =>
      expect(templatesApi.createVisaChecklistTemplate).toHaveBeenCalledWith(expect.objectContaining({ countryCode: "US", visaType: "Student", title: "Vé máy bay khứ hồi" })),
    );
  });

  it("surfaces 409 DUPLICATE_VISA_CHECKLIST_TEMPLATE verbatim via the shared conflict notice", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    templatesApi.listVisaChecklistTemplates.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    templatesApi.createVisaChecklistTemplate.mockRejectedValue(
      new ApiError(409, { error: { code: "DUPLICATE_VISA_CHECKLIST_TEMPLATE", message: "A template already exists.", requestId: "r1", existingTemplateId: "vct-existing" } }),
    );

    renderWithProviders(<VisaChecklistTemplatesPage />);
    await screen.findByText("Không có mẫu checklist nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo mẫu" }));
    await userEvent.type(screen.getAllByLabelText("Mã quốc gia (ISO-2) *")[0], "us");
    await userEvent.type(screen.getAllByLabelText("Loại visa *")[0], "Student");
    await userEvent.type(screen.getAllByLabelText("Tên hạng mục *")[0], "Hộ chiếu còn hạn");
    await userEvent.click(screen.getAllByRole("button", { name: "Tạo mẫu" })[0]);

    expect(await screen.findByText("Đã tồn tại mẫu checklist này (cùng quốc gia, loại visa, tên hạng mục).")).toBeInTheDocument();
  });
});
