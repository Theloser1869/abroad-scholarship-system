import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Public } from '../../../common/decorators/public.decorator';
import { verifyWebhookSignature } from '../../../common/webhooks/webhook-signature.util';
import { WebhooksService } from './webhooks.service';

/// Phase 12 — the one concrete webhook receiver this phase wires up (paired with the
/// `ESignProvider` adapter named in 12-platform/02_INTEGRATIONS_JOBS.md). Deliberately
/// side-effect-free on business data: it verifies, stores, and audits the incoming event
/// only — no Contract/Document row is ever mutated from here. `Contract.sign()`'s existing
/// staff-recorded FSM action (Phase 05) remains the only path that marks a contract
/// SIGNED; auto-mutating it from an unreviewed external event would be a new business rule
/// no MD names. See `docs/ASSUMPTIONS.md` ASM-53.
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('esign')
  @Audit('CREATE')
  async receiveEsignEvent(@Req() req: Request, @Headers('x-webhook-signature') signature: string | undefined) {
    const body = req.body as { eventId?: string; [key: string]: unknown };
    if (!body?.eventId || typeof body.eventId !== 'string') {
      throw new BadRequestException({ code: 'MISSING_EVENT_ID', message: 'eventId is required.' });
    }

    const secret = this.config.get<string>('ESIGN_WEBHOOK_SECRET') ?? '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    const signatureValid = secret.length > 0 && verifyWebhookSignature(rawBody, signature, secret);

    const { event, isNew } = await this.webhooks.recordEvent('esign', body.eventId, signatureValid, body);
    req.auditMetadata = { source: 'esign', eventId: body.eventId, signatureValid, duplicate: !isNew };
    if (!signatureValid) {
      throw new BadRequestException({ code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Webhook signature verification failed.' });
    }
    if (isNew) {
      // No business-data mutation — see this controller's own doc comment. A future phase
      // wiring a concrete "esign completed -> notify staff to review and sign" workflow
      // would extend this branch, not the signature/idempotency handling above it.
      await this.webhooks.markProcessed(event.id);
    }
    return { received: true, duplicate: !isNew };
  }
}
