import { JobRunnerService } from '../../src/common/jobs/job-runner.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/// `JobRunnerService.processPendingJobs()` only claims one batch (10 jobs) per call. When
/// many e2e spec files each enqueue their own DOCUMENT_SCAN/etc. jobs across a full
/// `--runInBand` regression run, an earlier file's unprocessed backlog can crowd a later
/// file's own job out of a single call's batch. Every spec that needs a job it just
/// enqueued to have actually run before asserting on its result should drain the whole
/// queue, not assume one call empties it.
///
/// **This only guarantees "nothing is immediately due right now."** If a job's first
/// attempt throws a `TransientJobError`, the runner reschedules it with a real backoff
/// delay (seconds+) — `processPendingJobs()` correctly reports 0 claimed for that job
/// until the delay elapses, so this loop exits while the job is still genuinely PENDING,
/// not done. `jobs-platform.e2e-spec.ts` relies on exactly this — it asserts a job is
/// still PENDING with `scheduledFor` in the future right after a `drainJobs` call, then
/// manually forces it due before draining again. Use `drainJobsToCompletion` below for
/// every other spec, which only cares whether an async side effect (e.g. a document scan)
/// has actually finished, not the backoff mechanics themselves.
export async function drainJobs(jobRunner: JobRunnerService): Promise<void> {
  let processed = 0;
  do {
    processed = await jobRunner.processPendingJobs();
  } while (processed > 0);
}

/// Same as `drainJobs`, but also fast-forwards any job still PENDING on a scheduled retry
/// so it becomes immediately due, instead of returning as soon as nothing is due *right
/// now*. Fixes an intermittent failure seen in specs that upload a document, drain once,
/// then immediately assert the resulting DOCUMENT_SCAN job's effect (scanStatus/download):
/// on the rare attempt where the scan processor's first pass throws a transient error
/// (e.g. a storage read hiccup), `drainJobs` alone returns while the retry is still
/// scheduled seconds into the future, and the very next request in the test — download,
/// checklist-linked-access, etc. — sees pre-scan state and fails non-deterministically.
/// Bounded iteration count as a safety net against a genuinely stuck job masquerading as
/// "done." Do not use this in `jobs-platform.e2e-spec.ts` — it asserts on the real backoff
/// delay itself, which this helper deliberately bypasses.
export async function drainJobsToCompletion(jobRunner: JobRunnerService, prisma: PrismaService): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    const processed = await jobRunner.processPendingJobs();
    if (processed > 0) continue;
    const stillPending = await prisma.backgroundJob.count({ where: { status: 'PENDING' } });
    if (stillPending === 0) return;
    // Nothing due right now, but something is scheduled for a future retry — bypass the
    // real backoff delay (same trick jobs-platform.e2e-spec.ts applies manually) so the
    // next iteration actually picks it up instead of silently returning "drained".
    await prisma.backgroundJob.updateMany({ where: { status: 'PENDING' }, data: { scheduledFor: new Date() } });
  }
  throw new Error('drainJobsToCompletion: jobs still pending after 20 iterations — a job may be stuck.');
}
