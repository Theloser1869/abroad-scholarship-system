import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ESignEnvelopeRequest, ESignEnvelopeResult, ESignProvider } from './esign-provider.interface';

/// Default `ESignProvider` — no real vendor credentials exist in this environment and no
/// concrete e-signature workflow is named by any Phase 01-12 instruction (see the
/// interface's own doc comment); this stub only exists to keep the DI wiring complete.
@Injectable()
export class NoopESignProvider implements ESignProvider {
  async createEnvelope(request: ESignEnvelopeRequest): Promise<ESignEnvelopeResult> {
    void request;
    return { envelopeId: randomUUID() };
  }
}
