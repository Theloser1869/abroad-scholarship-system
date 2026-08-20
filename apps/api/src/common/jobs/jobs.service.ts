import { Injectable } from '@nestjs/common';
import { BackgroundJob, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EnqueueOptions {
  /// Idempotency key — enqueueing the same `dedupeKey` twice is a no-op that returns the
  /// existing job row, never a duplicate. "Retry cùng một event không được tạo duplicate...
  /// phải dùng ... dedupe key ... rõ ràng" (12-platform/02_INTEGRATIONS_JOBS.md).
  dedupeKey?: string;
  scheduledFor?: Date;
  correlationId?: string;
  maxAttempts?: number;
}

/// Phase 12 — the enqueue side of the DB-backed job queue (`JobRunnerService` is the
/// worker side). See `docs/ASSUMPTIONS.md` ASM-52 for why this is a Postgres table + an
/// in-process poller rather than Redis/BullMQ.
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(jobType: string, payload: Record<string, unknown>, options: EnqueueOptions = {}): Promise<BackgroundJob> {
    if (options.dedupeKey) {
      const existing = await this.prisma.backgroundJob.findUnique({ where: { dedupeKey: options.dedupeKey } });
      if (existing) return existing;
    }
    try {
      return await this.prisma.backgroundJob.create({
        data: {
          jobType,
          payload: payload as Prisma.InputJsonValue,
          dedupeKey: options.dedupeKey,
          scheduledFor: options.scheduledFor ?? new Date(),
          correlationId: options.correlationId,
          maxAttempts: options.maxAttempts ?? 5,
        },
      });
    } catch (err) {
      // A concurrent enqueue with the same dedupeKey lost the race between the findUnique
      // check above and this insert — the unique constraint is the real idempotency
      // guarantee, the findUnique above is just an optimization to avoid the round trip in
      // the common case. Re-fetch and return the winner instead of erroring.
      if (options.dedupeKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.backgroundJob.findUnique({ where: { dedupeKey: options.dedupeKey } });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async getById(id: string): Promise<BackgroundJob | null> {
    return this.prisma.backgroundJob.findUnique({ where: { id } });
  }

  async list(jobType?: string, status?: string): Promise<BackgroundJob[]> {
    return this.prisma.backgroundJob.findMany({
      where: { ...(jobType ? { jobType } : {}), ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
