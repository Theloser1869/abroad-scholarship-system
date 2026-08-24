import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { SearchInput } from "./search-input";

/// F09 UX hardening (instruction §12 "clear search") — the shared search field now used by
/// every list page's debounced search (Leads/Students/Partners/Programs/Scholarship masters/
/// Universities/Visa checklist templates).
describe("SearchInput", () => {
  it("renders the current value and calls onChange as the user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput value="" onChange={onChange} aria-label="Tìm kiếm" />);

    await user.type(screen.getByRole("searchbox", { name: "Tìm kiếm" }), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows a clear button only when there is a value, and clears it on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<SearchInput value="" onChange={onChange} aria-label="Tìm kiếm" />);
    expect(screen.queryByRole("button", { name: "Xóa tìm kiếm" })).not.toBeInTheDocument();

    rerender(<SearchInput value="hello" onChange={onChange} aria-label="Tìm kiếm" />);
    await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
