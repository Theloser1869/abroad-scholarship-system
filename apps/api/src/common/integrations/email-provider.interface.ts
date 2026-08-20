/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "adapters: email"). `NotificationsService`
/// calls only this interface for the EMAIL channel — never an SMTP/vendor SDK directly. See
/// `docs/ASSUMPTIONS.md` ASM-52 for the default (`LogEmailProvider`) and why no real SMTP
/// credentials are wired in this environment.
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailMessage {
  to: string;
  event: string;
  subject: string;
  /// Non-sensitive template context only — 12-platform/02_INTEGRATIONS_JOBS.md "Không
  /// đưa sensitive data trực tiếp vào email nếu không cần... Không gửi password/token/
  /// secret plaintext." Callers must not put a raw token/password/signed-URL value here.
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
