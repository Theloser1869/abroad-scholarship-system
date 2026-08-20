import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/// Single Prisma connection for the whole modular monolith — every module injects this
/// instead of instantiating its own PrismaClient (TARGET_ARCHITECTURE.md section 3, one
/// logical PostgreSQL instance, table ownership enforced by convention not by connection).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
