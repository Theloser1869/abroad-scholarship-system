import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { ErrorContractFilter } from './filters/error-contract.filter';
import { AuthGuard } from './guards/auth.guard';
import { IdGeneratorService } from './id/id-generator.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';

/// Wires every cross-cutting Phase 02 convention (auth guard, audit hook, idempotency,
/// error contract) as global providers, and exposes IdGeneratorService to every domain
/// module without each one re-importing it. PrismaModule is registered separately (it is
/// also @Global()).
@Global()
@Module({
  providers: [
    IdGeneratorService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ErrorContractFilter },
  ],
  exports: [IdGeneratorService],
})
export class CommonModule {}
