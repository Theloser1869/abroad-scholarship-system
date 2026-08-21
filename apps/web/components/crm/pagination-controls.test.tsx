import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("renders nothing when there are zero total items", () => {
    const { container } = render(
      <PaginationControls meta={{ page: 1, limit: 20, totalItems: 0, totalPages: 0 }} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("disables 'Trước' on page 1 and 'Sau' on the last page", () => {
    render(<PaginationControls meta={{ page: 1, limit: 20, totalItems: 20, totalPages: 1 }} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();
  });

  it("calls onPageChange with page+1/page-1 — drives backend pagination, never a client-side slice", async () => {
    const onPageChange = vi.fn();
    render(<PaginationControls meta={{ page: 2, limit: 20, totalItems: 60, totalPages: 3 }} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Sau" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole("button", { name: "Trước" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
