import { JobRunnerService } from '../../src/common/jobs/job-runner.service';

/// `JobRunnerService.processPendingJobs()` only claims one batch (10 jobs) per call. When
/// many e2e spec files each enqueue their own DOCUMENT_SCAN/etc. jobs across a full
/// `--runInBand` regression run, an earlier file's unprocessed backlog can crowd a later
/// file's own job out of a single call's batch. Every spec that needs a job it just
/// enqueued to have actually run before asserting on its result should drain the whole
/// queue, not assume one call empties it.
export async function drainJobs(jobRunner: JobRunnerService): Promise<void> {
  let processed = 0;
  do {
    processed = await jobRunner.processPendingJobs();
  } while (processed > 0);
}
