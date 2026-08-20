import { Injectable } from '@nestjs/common';

/// Phase 12 adapter (12-platform/02_INTEGRATIONS_JOBS.md "adapters: calendar"). Same scope
/// reasoning as `ESignProvider` — no Phase 01-12 MD names a concrete calendar workflow
/// (e.g. Visa's `appointmentDate`/`interviewDate` fields, Phase 09, are plain DateTime
/// columns with no external calendar sync ever specified). Interface + no-op default only.
/// See `docs/ASSUMPTIONS.md` ASM-54.
export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');

export interface CalendarEventRequest {
  title: string;
  startAt: Date;
  attendeeEmail: string;
}

export interface CalendarEventResult {
  externalEventId: string;
}

export interface CalendarProvider {
  createEvent(request: CalendarEventRequest): Promise<CalendarEventResult>;
}

@Injectable()
export class NoopCalendarProvider implements CalendarProvider {
  async createEvent(request: CalendarEventRequest): Promise<CalendarEventResult> {
    void request;
    return { externalEventId: 'noop' };
  }
}
