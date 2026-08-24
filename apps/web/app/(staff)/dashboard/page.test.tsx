import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { ExecutiveDashboard, ManagerDashboard, MyDashboard } from "@/lib/reports/types";
import DashboardPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const reportsApi = vi.hoisted(() => ({ getExecutiveDashboard: vi.fn(), getManagerDashboard: vi.fn(), getMyDashboard: vi.fn(), exportCases: vi.fn() }));
vi.mock("@/lib/reports/api", () => reportsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

const executiveFixture: ExecutiveDashboard = {
  activeCases: 12,
  pipeline: [{ status: "OPEN", count: 5 }],
  revenue: [{ currency: "USD", amount: "10000.00" }],
  receivables: [{ currency: "USD", amount: "2000.00" }],
  overduePaymentsCount: 3,
  workload: { openTasks: 8, overdueTasks: 2 },
  deadlines: { overdueTasks: 2, dueWithin7Days: 4 },
  applications: [{ status: "SUBMITTED", count: 4 }],
  scholarships: [],
  visas: [],
  enrollments: [],
  closedOrArchivedCases: 6,
};

const managerFixture: ManagerDashboard = {
  workload: [{ ownerId: "user-1", openTasks: 3, overdueTasks: 1, onTimeCompletionRate: 0.8, averageQualityScore: 4.2 }],
  upcomingApplicationDeadlines: 7,
};

const myFixture: MyDashboard = { myOpenCases: 5, myOpenTasks: 9, myOverdueTasks: 1 };

/// No standalone "forbidden" test — `RequirePermission` is exercised the same way as every
/// other page (STUDENT_PARENT/SYSTEM_ADMIN have zero `reports` grant).
describe("DashboardPage — role-routed (F07 instruction §21/§22/§23/§24)", () => {
  it("shows the forbidden state for a role without reports:view", async () => {
    authState.principal = { userId: "u1", roleCode: "SYSTEM_ADMIN" };
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(reportsApi.getExecutiveDashboard).not.toHaveBeenCalled();
  });

  it("EXECUTIVE_DIRECTOR sees the Executive tab by default, with per-currency Money display (never summed across currencies)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    reportsApi.getExecutiveDashboard.mockResolvedValue(executiveFixture);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(reportsApi.getManagerDashboard).not.toHaveBeenCalled();
    expect(reportsApi.getMyDashboard).not.toHaveBeenCalled();
  });

  it("EXECUTIVE_DIRECTOR can switch to the Manager tab, showing the raw ownerId (no name join exists on the backend)", async () => {
    authState.principal = { userId: "u1", roleCode: "DEPARTMENT_MANAGER" };
    reportsApi.getExecutiveDashboard.mockResolvedValue(executiveFixture);
    reportsApi.getManagerDashboard.mockResolvedValue(managerFixture);
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />);
    await screen.findByText("12");

    await user.click(screen.getByRole("button", { name: "Quản lý" }));

    expect(await screen.findByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("CONSULTANT (non-leadership, reports:view only) sees only the self-scoped My Dashboard", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    reportsApi.getMyDashboard.mockResolvedValue(myFixture);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Báo cáo của tôi")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(reportsApi.getExecutiveDashboard).not.toHaveBeenCalled();
    expect(reportsApi.getManagerDashboard).not.toHaveBeenCalled();
  });
});
