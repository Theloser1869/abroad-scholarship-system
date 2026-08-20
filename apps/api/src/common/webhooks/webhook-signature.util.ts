import { createHmac } from 'node:crypto';
import { timingSafeStringEqual } from '../security/token.util';

/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "Webhooks: signature verification").
/// Standard HMAC-SHA256-over-raw-body verification — the same shape most real webhook
/// providers (Stripe, GitHub, DocuSign, ...) use. `rawBody` must be the exact bytes the
/// sender signed, not a re-serialized JSON object (re-serialization can silently produce a
/// byte-different string and always fail verification).
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeStringEqual(signatureHeader, expected);
}
