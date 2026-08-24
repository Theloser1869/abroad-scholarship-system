import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { StudentSwitcher } from "./student-switcher";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const portalApi = vi.hoisted(() => ({ getPortalMe: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("StudentSwitcher — the linked-child list always comes from GET /portal/me (F08 instruction §10)", () => {
  it("renders nothing for a lone Student-self (only one accessible student)", async () => {
    portalApi.getPortalMe.mockResolvedValue({ userId: "u1", roleCode: "STUDENT_PARENT", students: [{ id: "student-A", studentCode: "HS-1", fullName: "A", relationship: "SELF" }] });
    renderWithProviders(<StudentSwitcher currentStudentId="student-A" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByLabelText("Chuyển đổi học sinh")).not.toBeInTheDocument();
  });

  it("renders a select with every linked child for a multi-child Parent, and switching navigates to the new student's Overview (never a stale deep sub-page)", async () => {
    portalApi.getPortalMe.mockResolvedValue({
      userId: "u1",
      roleCode: "STUDENT_PARENT",
      students: [
        { id: "student-A", studentCode: "HS-1", fullName: "Con A", relationship: "Mẹ" },
        { id: "student-B", studentCode: "HS-2", fullName: "Con B", relationship: "Mẹ" },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<StudentSwitcher currentStudentId="student-A" />);

    const select = await screen.findByLabelText("Chuyển đổi học sinh");
    await user.selectOptions(select, "student-B");

    expect(pushMock).toHaveBeenCalledWith("/portal/students/student-B");
  });
});
