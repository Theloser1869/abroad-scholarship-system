import { Injectable, Logger } from '@nestjs/common';

/// Phase 12 adapter (12-platform/02_INTEGRATIONS_JOBS.md "adapters: SMS/Zalo/WhatsApp").
/// `NotificationChannel` (Phase 02/06) only has IN_APP/EMAIL — no Phase 01-12 MD names a
/// concrete requirement to add an SMS channel to the Notification fan-out, so this stays
/// interface + default only (logs, never a real send), same scope reasoning as
/// `ESignProvider`. Ready for a future phase to wire a real channel behind it without
/// touching `NotificationsService`'s existing IN_APP/EMAIL logic. See
/// `docs/ASSUMPTIONS.md` ASM-54.
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsMessage {
  to: string;
  event: string;
  body: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

@Injectable()
export class LogSmsProvider implements SmsProvider {
  private readonly logger = new Logger(LogSmsProvider.name);

  async send(message: SmsMessage): Promise<void> {
    this.logger.log(`sms dispatched to=${message.to} event=${message.event}`);
  }
}
