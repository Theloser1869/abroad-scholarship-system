import { Global, Module } from '@nestjs/common';
import { ACCOUNTING_PROVIDER } from './accounting-provider.interface';
import { NoopAccountingProvider } from './accounting-provider.interface';
import { CALENDAR_PROVIDER, NoopCalendarProvider } from './calendar-provider.interface';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ESIGN_PROVIDER } from './esign-provider.interface';
import { EXTERNAL_SCHOOL_DATA_PROVIDER, NoopExternalSchoolDataProvider } from './external-school-data-provider.interface';
import { LogEmailProvider } from './log-email.provider';
import { NoopESignProvider } from './noop-esign.provider';
import { LogSmsProvider, SMS_PROVIDER } from './sms-provider.interface';

/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Domain phải gọi adapter/interface, không
/// hard-code provider-specific logic"). Every adapter token is bound to its default
/// implementation here, once — a real provider swap-in later only ever touches this one
/// file's `useClass` line, never a domain service.
@Global()
@Module({
  providers: [
    { provide: EMAIL_PROVIDER, useClass: LogEmailProvider },
    { provide: ESIGN_PROVIDER, useClass: NoopESignProvider },
    { provide: CALENDAR_PROVIDER, useClass: NoopCalendarProvider },
    { provide: ACCOUNTING_PROVIDER, useClass: NoopAccountingProvider },
    { provide: SMS_PROVIDER, useClass: LogSmsProvider },
    { provide: EXTERNAL_SCHOOL_DATA_PROVIDER, useClass: NoopExternalSchoolDataProvider },
  ],
  exports: [EMAIL_PROVIDER, ESIGN_PROVIDER, CALENDAR_PROVIDER, ACCOUNTING_PROVIDER, SMS_PROVIDER, EXTERNAL_SCHOOL_DATA_PROVIDER],
})
export class IntegrationsModule {}
