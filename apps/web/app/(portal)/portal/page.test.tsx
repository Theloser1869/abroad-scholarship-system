import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import PortalHomePage from "./page";

const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, replace: replaceMock }) }));

const portalApi = vi.hoisted(() => ({ getPortalMe: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
});

/// F08 instruction §6: "one route tree, not two" — Student-self vs. Parent is not a page
/// distinction, only how many `GET /portal/me` returns.
describe("PortalHomePage — resolved entirely from GET /portal/me, never a client guess", () => {
  it("shows an empty state when the caller has zero accessible students", async () => {
    portalApi.getPortalMe.mockResolvedValue({ userId: "u1", roleCode: "STUDENT_PARENT", students: [] });
    renderWithProviders(<PortalHomePage />);
    expect(await screen.findByText(/Chưa có học sinh nào được liên kết/)).toBeInTheDocument();
  });

  it("auto-redirects straight to the Overview for a single accessible student (Student-self, or a one-child Parent)", async () => {
    portalApi.getPortalMe.mockResolvedValue({ userId: "u1", roleCode: "STUDENT_PARENT", students: [{ id: "student-A", studentCode: "HS-1", fullName: "A", relationship: "SELF" }] });
    renderWithProviders(<PortalHomePage />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/portal/students/student-A"));
  });

  it("renders a picker card per student for a multi-child Parent, never auto-navigating", async () => {
    portalApi.getPortalMe.mockResolvedValue({
      userId: "u1",
      roleCode: "STUDENT_PARENT",
      students: [
        { id: "student-A", studentCode: "HS-1", fullName: "Con A", relationship: "Mẹ" },
        { id: "student-B", studentCode: "HS-2", fullName: "Con B", relationship: "Mẹ" },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<PortalHomePage />);

    expect(await screen.findByText("Con A")).toBeInTheDocument();
    expect(screen.getByText("Con B")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    await user.click(screen.getByText("Con B"));
    expect(screen.getByRole("link", { name: /Con B/ })).toHaveAttribute("href", "/portal/students/student-B");
  });
});
