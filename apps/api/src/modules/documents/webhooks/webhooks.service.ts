import { Injectable } from '@nestjs/common';
import { IncomingWebhookEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Webhooks: signature verification,
/// idempotency, event ID storage, retry, audit"). Generic across any future webhook
/// source — `source` names which one (e.g. `'esign'`). `(source, eventId)` uniqueness is
/// the idempotency/replay-protection mechanism; a duplicate delivery is recognized here,
/// before any business-data mutation is attempted ("Incoming webhook không được trực tiếp
/// mutate business data trước khi validation").
@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  /// Returns the existing row (never creates a second one) if `(source, eventId)` was
  /// already recorded — the caller uses this to short-circuit before reprocessing.
  async recordEvent(source: string, eventId: string, signatureValid: boolean, payload: unknown): Promise<{ event: IncomingWebhookEvent; isNew: boolean }> {
    const existing = await this.prisma.incomingWebhookEvent.findUnique({ where: { source_eventId: { source, eventId } } });
    if (existing) {
      // Phase 13 fix — a prior delivery under this `eventId` that FAILED signature
      // verification never represented a genuine event (anyone can guess/intercept an
      // eventId and submit garbage). Letting that forged row permanently occupy the
      // `(source, eventId)` slot would silently swallow the real, validly-signed delivery
      // the legitimate provider sends afterward under the same id — it'd be recorded as
      // `duplicate: true` and never reach `markProcessed`. Only a previously-VALID delivery
      // is genuine replay-protection territory; an invalid one gets "upgraded" in place the
      // first time a valid signature actually arrives for that id.
      if (!existing.signatureValid && signatureValid) {
        const upgraded = await this.prisma.incomingWebhookEvent.update({
          where: { id: existing.id },
          data: { signatureValid: true, payload: payload as Prisma.InputJsonValue, status: 'RECEIVED' },
        });
        return { event: upgraded, isNew: true };
      }
      return { event: existing, isNew: false };
    }

    try {
      const event = await this.prisma.incomingWebhookEvent.create({
        data: { source, eventId, signatureValid, payload: payload as Prisma.InputJsonValue, status: signatureValid ? 'RECEIVED' : 'REJECTED' },
      });
      return { event, isNew: true };
    } catch (err) {
      // Concurrent delivery of the same event lost the race — the unique constraint is the
      // real guarantee, this is just the retry path for the lost race.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.incomingWebhookEvent.findUnique({ where: { source_eventId: { source, eventId } } });
        if (raced) return { event: raced, isNew: false };
      }
      throw err;
    }
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.incomingWebhookEvent.update({ where: { id }, data: { status: 'PROCESSED', processedAt: new Date() } });
  }
}
