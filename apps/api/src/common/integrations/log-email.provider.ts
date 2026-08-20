import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailProvider } from './email-provider.interface';

/// Default `EmailProvider` — no real SMTP/vendor credentials exist in this environment
/// (`docs/ASSUMPTIONS.md` ASM-52), so this logs the send (recipient + event + subject only
/// — never the body, which callers should treat as potentially containing user-facing
/// content not meant for operational logs) and reports success. Swapping in a real
/// provider (SES/SendGrid/etc.) later is a one-file change behind `EmailProvider`.
@Injectable()
export class LogEmailProvider implements EmailProvider {
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`email dispatched to=${message.to} event=${message.event} subject="${message.subject}"`);
  }
}
