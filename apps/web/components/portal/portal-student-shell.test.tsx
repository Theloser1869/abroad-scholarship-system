import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { Student } from "@/lib/students/types";
import { PortalStudentShell } from "./portal-student-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal/students/student-A", useRouter: () => ({ push: vi.fn() }) }));

const portalApi = vi.hoisted(() => ({ getPortalMe: vi.fn(), getPortalProfile: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
  portalApi.getPortalMe.mockResolvedValue({ userId: "u1", roleCode: "STUDENT_PARENT", students: [] });
});

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "student-A",
    studentCode: "HS-0001",
    fullName: "Nguyễn Văn A",
    dateOfBirth: null,
    email: null,
    phone: null,
    targetCountry: null,
    targetMajor: null,
    targetIntake: null,
    scholarshipGoal: null,
    budget: null,
    budgetCurrency: null,
    archivedAt: null,
    portalUserId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/// This shell is the shared authorization probe for every `/portal/students/[id]/...` page —
/// F08 instruction §5/§29/§33: the backend decides, via a plain 404 on the SAME
/// `GET /portal/students/:id` call every sub-page's header needs anyway, whether a route
/// param is actually authorized (own student, linked+ACTIVE child, or 404 for anyone else —
/// cross-student, unlinked child, or a parent whose relationship was revoked, all
/// indistinguishable by design).
describe("PortalStudentShell — the shared authorization probe (F08 instruction §5/§29/§33)", () => {
  it("renders the header + children once the backend confirms the studentId is accessible", async () => {
    portalApi.getPortalProfile.mockResolvedValue(makeStudent());
    renderWithProviders(
      <PortalStudentShell studentId="student-A">
        <p>child content</p>
      </PortalStudentShell>,
    );
    expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("shows the exact non-enumerating message — never children — for a 404 (cross-student, unlinked, or revoked)", async () => {
    portalApi.getPortalProfile.mockRejectedValue(new ApiError(404, { error: { code: "STUDENT_NOT_FOUND", message: "not found", requestId: "r1" } }));
    renderWithProviders(
      <PortalStudentShell studentId="student-B">
        <p>child content</p>
      </PortalStudentShell>,
    );
    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
    expect(screen.queryByText("child content")).not.toBeInTheDocument();
  });

  it("never shows a previous child's data while the new child's authorization probe is pending or after it resolves (F09 instruction §19/§27 cross-child isolation)", async () => {
    portalApi.getPortalProfile.mockImplementation((id: string) =>
      Promise.resolve(id === "student-A" ? makeStudent({ id: "student-A", fullName: "Nguyễn Văn A" }) : makeStudent({ id: "student-B", fullName: "Trần Thị B" })),
    );

    const first = renderWithProviders(
      <PortalStudentShell studentId="student-A">
        <p>Child A content</p>
      </PortalStudentShell>,
    );
    expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Child A content")).toBeInTheDocument();

    // Simulates the navigation StudentSwitcher performs — a real route change unmounts the
    // old page and mounts a new one (never an in-place update carrying old state forward),
    // and a different studentId is a completely different query-cache key
    // (queryKeys.portal.student.profile embeds it), so the new mount must go through its
    // own fresh loading state — never render Child A's stale name/content while Child B's
    // own probe is in flight.
    first.unmount();
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.queryByText("Child A content")).not.toBeInTheDocument();

    renderWithProviders(
      <PortalStudentShell studentId="student-B">
        <p>Child B content</p>
      </PortalStudentShell>,
    );
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.queryByText("Child A content")).not.toBeInTheDocument();

    expect(await screen.findByText("Trần Thị B")).toBeInTheDocument();
    expect(screen.getByText("Child B content")).toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.queryByText("Child A content")).not.toBeInTheDocument();
  });
});
