import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { LeadConvertDialog } from "./lead-convert-dialog";
import { ApiError } from "@/lib/api/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function renderDialog(onSubmit: (input: unknown) => Promise<unknown>) {
  return render(
    <ToastProvider>
      <LeadConvertDialog open onClose={vi.fn()} onSubmit={onSubmit as never} submitting={false} />
    </ToastProvider>,
  );
}

describe("LeadConvertDialog — duplicate-detection protocol (F03 §9)", () => {
  it("navigates to the returned Case ID on a clean (no-duplicate) conversion — never a client-constructed ID", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      student: { id: "s1", studentCode: "HS-0001", fullName: "A" },
      case: { id: "case-99", caseCode: "C-0001" },
      merged: false,
    });
    renderDialog(onSubmit);

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cases/case-99"));
    expect(onSubmit).toHaveBeenCalledWith({});
  });

  it("re-renders with the backend's duplicate candidates on 409 DUPLICATE_STUDENT_CANDIDATES, then resubmits with confirmMatch", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(409, {
          error: {
            code: "DUPLICATE_STUDENT_CANDIDATES",
            message: "dup",
            requestId: "r1",
            candidates: [{ id: "cand-1", studentCode: "HS-0002", fullName: "Trùng A", email: "x@e.com", phone: null }],
          },
        }),
      )
      .mockResolvedValueOnce({
        student: { id: "cand-1", studentCode: "HS-0002", fullName: "Trùng A" },
        case: { id: "case-77", caseCode: "C-0002" },
        merged: true,
      });
    renderDialog(onSubmit);

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));

    expect(await screen.findByText("Trùng A (HS-0002)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(screen.getByRole("button", { name: "Gộp vào học sinh đã chọn" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenNthCalledWith(2, { confirmMatch: "MERGE", mergeIntoStudentId: "cand-1" }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cases/case-77"));
  });

  it("'Tạo học sinh mới' resubmits with confirmMatch CREATE_NEW, never a client-side guess at which candidate to use", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(409, {
          error: {
            code: "DUPLICATE_STUDENT_CANDIDATES",
            message: "dup",
            requestId: "r1",
            candidates: [{ id: "cand-1", studentCode: "HS-0002", fullName: "Trùng A", email: null, phone: null }],
          },
        }),
      )
      .mockResolvedValueOnce({
        student: { id: "new-1", studentCode: "HS-0003", fullName: "B" },
        case: { id: "case-88", caseCode: "C-0003" },
        merged: false,
      });
    renderDialog(onSubmit);

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển đổi" }));
    await screen.findByText("Trùng A (HS-0002)");

    await userEvent.click(screen.getByRole("button", { name: "Tạo học sinh mới" }));

    await waitFor(() => expect(onSubmit).toHaveBeenNthCalledWith(2, { confirmMatch: "CREATE_NEW" }));
  });
});
