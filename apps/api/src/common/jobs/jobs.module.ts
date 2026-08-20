import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { JobRunnerService } from './job-runner.service';
import { JobsAdminController } from './jobs-admin.controller';
import { JobsService } from './jobs.service';

@Global()
@Module({
  controllers: [JobsAdminController],
  providers: [JobsService, JobRunnerService],
  exports: [JobsService, JobRunnerService],
})
export class JobsModule implements OnApplicationBootstrap {
  constructor(private readonly runner: JobRunnerService) {}

  /// Starts polling only once the whole application (every domain module's own
  /// `onModuleInit` processor registrations included) has finished bootstrapping — so no
  /// job type is ever polled before its handler is registered. Skipped under
  /// `NODE_ENV=test` (Jest's default) — a real wall-clock timer racing against a test's
  /// own explicit `processPendingJobs()` call is exactly the nondeterminism this method
  /// was designed to be independently callable to avoid; every e2e test drives job
  /// processing explicitly instead. Production/dev behavior (`NODE_ENV` unset or anything
  /// else) is unaffected — polling still starts automatically, "không phụ thuộc vào user
  /// mở UI."
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.runner.startPolling();
  }
}
