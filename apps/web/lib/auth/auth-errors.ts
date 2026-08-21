import { ApiError } from "../api/types";

/// Login/session error-code → Vietnamese message, transcribed from
/// docs/security/AUTH_MODEL.md §4 ("Login error codes: generic where enumeration matters,
/// specific where it doesn't"). `INVALID_CREDENTIALS` deliberately stays generic (same
/// message for "no such user" and "wrong password") — the frontend must not try to be
/// smarter than the backend here (e.g. never render a different message based on any local
/// guess about which case it is).
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
  }
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Tên đăng nhập hoặc mật khẩu không đúng.";
    case "ACCOUNT_LOCKED": {
      const lockedUntil = error.raw.lockedUntil;
      const until = typeof lockedUntil === "string" ? new Date(lockedUntil).toLocaleTimeString("vi-VN") : null;
      return until
        ? `Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${until}.`
        : "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.";
    }
    case "ACCOUNT_SUSPENDED":
      return "Tài khoản đã bị tạm ngưng. Liên hệ quản trị viên.";
    case "ACCOUNT_OFFBOARDED":
      return "Tài khoản đã ngừng hoạt động.";
    case "ACCOUNT_NOT_ACTIVE":
      return "Tài khoản hiện không hoạt động.";
    case "INVALID_MFA_CODE":
      return "Mã xác thực không đúng. Vui lòng thử lại.";
    case "INVALID_REFRESH_TOKEN":
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    case "RATE_LIMITED":
      return "Bạn đã thử quá nhiều lần. Vui lòng đợi một chút rồi thử lại.";
    default:
      return error.message || "Đăng nhập không thành công. Vui lòng thử lại.";
  }
}
