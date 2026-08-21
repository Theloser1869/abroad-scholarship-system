import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/types";
import { QueryErrorState, ScopeErrorState, EmptyState, LoadingState } from "./query-states";

describe("QueryErrorState — API error mapping", () => {
  it("renders the exact 404-non-enumeration copy for a 404 ApiError", () => {
    render(<QueryErrorState error={new ApiError(404, { error: { code: "X_NOT_FOUND", message: "x", requestId: "r1" } })} />);
    expect(screen.getByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("renders the same 404-non-enumeration copy for a 403 — never distinguishes forbidden from not-found", () => {
    render(<QueryErrorState error={new ApiError(403, { error: { code: "PERMISSION_DENIED", message: "x", requestId: "r1" } })} />);
    expect(screen.getByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("renders a generic error message + requestId for a 500, and calls onRetry when clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const onRetry = vi.fn();
    render(<QueryErrorState error={new ApiError(500, { error: { code: "INTERNAL_ERROR", message: "boom", requestId: "req-42" } })} onRetry={onRetry} />);

    expect(screen.getByText("Đã xảy ra lỗi khi tải dữ liệu.")).toBeInTheDocument();
    expect(screen.getByText("req-42", { exact: false })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders a generic message for a non-ApiError (network failure/unexpected exception)", () => {
    render(<QueryErrorState error={new Error("network down")} />);
    expect(screen.getByText("Đã xảy ra lỗi không xác định.")).toBeInTheDocument();
  });
});

describe("ScopeErrorState / EmptyState / LoadingState", () => {
  it("ScopeErrorState never renders the forbidden-specific wording", () => {
    render(<ScopeErrorState />);
    expect(screen.getByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
    expect(screen.queryByText(/tồn tại nhưng/)).not.toBeInTheDocument();
  });

  it("EmptyState renders title and optional description", () => {
    render(<EmptyState title="Trống" description="Không có dữ liệu." />);
    expect(screen.getByText("Trống")).toBeInTheDocument();
    expect(screen.getByText("Không có dữ liệu.")).toBeInTheDocument();
  });

  it("LoadingState renders an accessible status region", () => {
    render(<LoadingState rows={3} />);
    expect(screen.getByRole("status", { name: "Đang tải dữ liệu" })).toBeInTheDocument();
  });
});
