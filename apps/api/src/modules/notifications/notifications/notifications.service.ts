import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { JobsService } from '../../../common/jobs/jobs.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

export const EMAIL_DISPATCH_JOB_TYPE = 'NOTIFICATION_EMAIL_DISPATCH';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const SORTABLE_FIELDS = ['createdAt', 'sentAt'] as const;

/// 06-operations/02_NOTIFICATION.md. Domain 10 per docs/architecture/DOMAIN_MAP.md
/// ("notifications nhận event từ mọi domain") — every other domain calls INTO this
/// service (`notify`), this service never reaches back out into another domain's tables
/// to decide what happened; recipient resolution (who gets notified) is the CALLING
/// domain's job (it knows its own ownership/collaborator/role rules), this service only
/// resolves HOW to deliver once given a recipient.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  /// Single-channel write. `dedupeKey`, when supplied, makes a retried/duplicated call a
  /// no-op via `Notification.dedupeKey`'s unique constraint — 06-operations/
  /// 02_NOTIFICATION.md "Prevent duplicate sends." IN_APP is considered delivered the
  /// instant the row exists (`sentAt = now`) — the inbox IS the delivery mechanism, no
  /// external step. EMAIL now enqueues a real dispatch job (Phase 12 — see
  /// `EMAIL_DISPATCH_JOB_TYPE`'s processor in `NotificationsModule`) instead of leaving
  /// `sentAt` permanently null; the job's own `dedupeKey` reuses this notification's row
  /// id, so a retried job can never double-send. `sentAt` is set by the job on success.
  async notify(
    recipientId: string,
    event: string,
    channel: NotificationChannel,
    payload: Record<string, unknown>,
    dedupeKey?: string,
  ): Promise<Notification | null> {
    let notification: Notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          recipientId,
          event,
          channel,
          payload: payload as Prisma.InputJsonValue,
          dedupeKey,
          sentAt: channel === 'IN_APP' ? new Date() : null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
        // Same event already notified this recipient — the desired end state (exactly one
        // notification for this dedupeKey) already holds; nothing to do.
        return null;
      }
      throw err;
    }

    if (channel === 'EMAIL') {
      await this.jobs.enqueue(
        EMAIL_DISPATCH_JOB_TYPE,
        { notificationId: notification.id },
        { dedupeKey: `email-dispatch:${notification.id}` },
      );
    }
    return notification;
  }

  /// Called only by the `EMAIL_DISPATCH_JOB_TYPE` job processor once `EmailProvider.send`
  /// succeeds — the one place `sentAt` is set for an EMAIL-channel row.
  async markEmailSent(notificationId: string): Promise<void> {
    await this.prisma.notification.update({ where: { id: notificationId }, data: { sentAt: new Date() } });
  }

  /// SRS 6.20 "Kênh: in-app + email bắt buộc" — every notification event fans out to both
  /// channels, not caller-selectable. Two rows, one per channel, each with its own
  /// per-channel dedupeKey derived from `dedupeKeyBase` so a retry of the same logical
  /// event never double-sends on either channel independently.
  async notifyBothChannels(recipientId: string, event: string, payload: Record<string, unknown>, dedupeKeyBase?: string): Promise<void> {
    await this.notify(recipientId, event, 'IN_APP', payload, dedupeKeyBase ? `${dedupeKeyBase}:in_app` : undefined);
    await this.notify(recipientId, event, 'EMAIL', payload, dedupeKeyBase ? `${dedupeKeyBase}:email` : undefined);
  }

  /// A caller's own inbox only — `recipientId` is always the caller, never
  /// client-suppliable ("Notification phải tôn trọng RBAC và recipient scope" —
  /// 06-operations/02_NOTIFICATION.md; SRS 6.20).
  async listInbox(principal: Principal, query: NotificationQueryDto): Promise<PaginatedResult<Notification>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.NotificationWhereInput = {
      recipientId: principal.userId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async markRead(principal: Principal, id: string): Promise<Notification> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.recipientId !== principal.userId) {
      // 404 regardless of "doesn't exist" vs "belongs to someone else" — same AC-02-style
      // non-enumeration pattern used everywhere else in this API.
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: `Notification ${id} not found.` });
    }
    if (existing.readAt) return existing;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
