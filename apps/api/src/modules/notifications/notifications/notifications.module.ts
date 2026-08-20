import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { EMAIL_PROVIDER, EmailProvider } from '../../../common/integrations/email-provider.interface';
import { JobRunnerService } from '../../../common/jobs/job-runner.service';
import { TransientJobError } from '../../../common/jobs/job-error';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsController } from './notifications.controller';
import { EMAIL_DISPATCH_JOB_TYPE, NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /// The one real (non-stub) job processor registered by a domain module in this phase's
  /// adapter architecture — see `docs/ASSUMPTIONS.md` ASM-52/ASM-54 for why EMAIL is wired
  /// through and the other adapters (ESign/Calendar/Accounting/SMS) are not.
  onModuleInit(): void {
    this.runner.registerProcessor(EMAIL_DISPATCH_JOB_TYPE, async (payload) => {
      const notificationId = payload.notificationId as string;
      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
        include: { recipient: { select: { email: true } } },
      });
      if (!notification) return; // Recipient/notification no longer exists — nothing to send, not a retryable error.

      try {
        await this.email.send({
          to: notification.recipient.email,
          event: notification.event,
          subject: `[Abroad Scholarship] ${notification.event}`,
          body: `You have a new ${notification.event} update. Please sign in to view details.`,
        });
      } catch (err) {
        throw new TransientJobError(`Email dispatch failed: ${(err as Error).message}`);
      }
      await this.notifications.markEmailSent(notificationId);
    });
  }
}
