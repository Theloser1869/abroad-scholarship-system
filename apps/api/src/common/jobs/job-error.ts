/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Không retry mù. Phải phân biệt: transient
/// failure, permanent failure"). A processor throws `TransientJobError` for anything
/// worth retrying (a timeout, a temporary lock, an external provider's 5xx) — the runner
/// reschedules with backoff. Any OTHER thrown error (validation failure, a referenced
/// record no longer existing, ...) is treated as permanent — the runner marks the job
/// FAILED immediately, without burning through retry attempts on something retrying can
/// never fix.
export class TransientJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientJobError';
  }
}
