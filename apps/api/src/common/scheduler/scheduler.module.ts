import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Global()
@Module({
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule implements OnApplicationBootstrap {
  constructor(private readonly scheduler: SchedulerService) {}

  /// Same `NODE_ENV=test` skip as `JobsModule` — see that method's doc comment.
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.scheduler.startTicking();
  }
}
