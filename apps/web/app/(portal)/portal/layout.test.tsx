import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import PortalLayout from "./layout";

const authState = vi.hoisted(() => ({ status: "AUTHENTICATED" as const, principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ usePathname: () => "/portal", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const notificationsApi = vi.hoisted(() => ({ listNotifications: vi.fn() }));
vi.mock("@/lib/notifications/notifications-api", () => notificationsApi);

beforeEach(() => {
  vi.resetAllMocks();
  notificationsApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 1, totalItems: 0, totalPages: 0 } });
});

/// F08 instruction §37 AUTH: "staff role does not accidentally render portal home." Matches
/// the backend's own class-level `@RequirePermission('portal', 'access')` gate on
/// `PortalController` exactly — `portal:access` is granted ONLY to STUDENT_PARENT.
describe("PortalLayout — the Portal shell boundary", () => {
  it("shows the exact forbidden message for a staff role (CONSULTANT has no portal:access grant)", () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(
      <PortalLayout>
        <p>portal page content</p>
      </PortalLayout>,
    );
    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
    expect(screen.queryByText("portal page content")).not.toBeInTheDocument();
  });

  it("renders the Portal shell (header + children) for STUDENT_PARENT", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    renderWithProviders(
      <PortalLayout>
        <p>portal page content</p>
      </PortalLayout>,
    );
    expect(await screen.findByText("Cổng thông tin Học sinh & Phụ huynh")).toBeInTheDocument();
    expect(screen.getByText("portal page content")).toBeInTheDocument();
  });
});
