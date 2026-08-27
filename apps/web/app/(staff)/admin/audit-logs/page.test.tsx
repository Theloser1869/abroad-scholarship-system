import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { AuditLog } from "@/lib/audit-logs/types";
import AuditLogsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const auditLogsApi = vi.hoisted(() => ({ listAuditLogs: vi.fn() }));
vi.mock("@/lib/audit-logs/api", () => auditLogsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log-1",
    actorId: "user-1",
    action: "VIEW",
    objectType: "Student",
    objectId: "student-1",
    studentId: "student-1",
    caseId: null,
    result: "SUCCESS",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    beforeSnapshot: null,
    afterSnapshot: null,
    metadata: null,
    requestId: "req-1",
    createdAt: "2026-01-01T08:00:00.000Z",
    ...overrides,
  };
}

// sheet07 (Audit_Log) — the previously-unbuilt staff-facing viewer for the AuditLog table
// (backend `GET /audit-logs` already existed; `nav-config.ts` had it marked `implemented: false`).
describe("AuditLogsPage — staff-facing viewer for sheet07 (Audit_Log)", () => {
  it("shows the forbidden state for a role without audit_logs:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(<AuditLogsPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(auditLogsApi.listAuditLogs).not.toHaveBeenCalled();
  });

  it("EXECUTIVE_DIRECTOR sees the audit log table with the 8 sheet07 columns' data", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    auditLogsApi.listAuditLogs.mockResolvedValue({
      data: [makeAuditLog()],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("student-1")).toBeInTheDocument();
    expect(screen.getByText("VIEW")).toBeInTheDocument();
    expect(screen.getByText("Student #student-1")).toBeInTheDocument();
    expect(screen.getByText("Thành công")).toBeInTheDocument();
  });

  it("SYSTEM_ADMIN can also read it (audit_logs:view is held by ED and SYSTEM_ADMIN both)", async () => {
    authState.principal = { userId: "u2", roleCode: "SYSTEM_ADMIN" };
    auditLogsApi.listAuditLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });

    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText("Không có bản ghi audit log nào.")).toBeInTheDocument();
  });

  it("shows a DENIED result badge distinctly (sheet07 row4's 'Denied/Approved' example)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    auditLogsApi.listAuditLogs.mockResolvedValue({
      data: [makeAuditLog({ id: "log-2", action: "DOWNLOAD", objectType: "Document", result: "DENIED" })],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    renderWithProviders(<AuditLogsPage />);

    expect(await screen.findByText("Từ chối")).toBeInTheDocument();
  });

  it("debounces the actorId filter into a real query param (never client-side filtering)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    auditLogsApi.listAuditLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    const user = userEvent.setup();

    renderWithProviders(<AuditLogsPage />);
    await screen.findByText("Không có bản ghi audit log nào.");

    await user.type(screen.getByLabelText("Lọc theo User ID"), "user-42");

    await waitFor(() => expect(auditLogsApi.listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ actorId: "user-42" })));
  });
});
