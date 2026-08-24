import { describe, expect, it } from "vitest";
import { ApiError } from "./types";
import { crmErrorMessage } from "./error-messages";

describe("crmErrorMessage — F09 hardening: validation `details` are surfaced, not silently dropped", () => {
  it("prefers a mapped business code's message over anything else", () => {
    const error = new ApiError(404, { error: { code: "STUDENT_NOT_FOUND", message: "raw", requestId: "r1" } });
    expect(crmErrorMessage(error)).toBe("Không tìm thấy học sinh.");
  });

  it("falls back to joined class-validator `details` messages for an unmapped code (e.g. the generic 400 validation failure)", () => {
    // Mirrors the real shape `ErrorContractFilter` produces for a `ValidationPipe` failure —
    // no business `code`, a generic top-level `message`, real field errors in `details`.
    const error = new ApiError(400, {
      error: {
        code: "BAD_REQUEST",
        message: "Bad Request Exception",
        requestId: "r1",
        details: ["email must be an email", "fullName should not be empty"],
      },
    });
    expect(crmErrorMessage(error)).toBe("email must be an email fullName should not be empty");
  });

  it("ignores non-string entries in details and falls back to the raw message if none remain", () => {
    const error = new ApiError(400, { error: { code: "BAD_REQUEST", message: "raw message", requestId: "r1", details: [{ field: "x" }] } });
    expect(crmErrorMessage(error)).toBe("raw message");
  });

  it("falls back to the raw server message when there is no mapped code and no usable details", () => {
    const error = new ApiError(500, { error: { code: "SOME_NEW_UNMAPPED_CODE", message: "Something specific from the server.", requestId: "r1" } });
    expect(crmErrorMessage(error)).toBe("Something specific from the server.");
  });

  it("returns a generic Vietnamese message for a non-ApiError value", () => {
    expect(crmErrorMessage(new Error("network down"))).toBe("Đã xảy ra lỗi không xác định. Vui lòng thử lại.");
  });
});
