import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Idempotent } from '../../../common/idempotency/idempotency.interceptor';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { ExportPaymentsQueryDto } from './dto/export-payments-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { WaivePaymentDto } from './dto/waive-payment.dto';
import { PaymentsService, PaymentWithComputed } from './payments.service';

/// 05-commercial/02_PAYMENT.md reference implementation — flat `/payments/:id` actions.
/// Schedule listing/creation is nested under Contract — see `ContractPaymentsController`.
/// Every mutating route re-checks scope via `PaymentsService.getById` (which calls
/// `ScopePolicyService.assertPaymentAccessible`) before writing, then field-redacts the
/// response via `FieldPolicyService.redactPayment` — same defense-in-depth pattern as
/// `ContractsController`.
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get('export')
  @RequirePermission('payments', 'export')
  @Audit('EXPORT')
  async export(@CurrentUser() principal: Principal | null, @Query() query: ExportPaymentsQueryDto, @Req() req: Request) {
    const actor = requirePrincipal(principal);
    const { rows, rowCount } = await this.payments.export(actor);
    const redacted = rows.map((row) => this.redact(row, actor.roleCode));
    const fields = redacted.length > 0 ? Object.keys(redacted[0]) : [];
    req.auditMetadata = { reason: query.reason, filterScope: 'scope-filtered list (see ScopePolicyService)', rowCount, fields };
    return { rows: redacted, rowCount };
  }

  /// Same manually-triggerable-reminder-sweep pattern as `TasksController.runReminders`
  /// (see that method's doc comment for why no scheduler wires this automatically yet).
  @Post('reminders/run')
  @Audit('EDIT')
  async runReminders(@CurrentUser() principal: Principal | null) {
    const actor = requirePrincipal(principal);
    if (actor.roleCode !== 'SYSTEM_ADMIN' && actor.roleCode !== 'EXECUTIVE_DIRECTOR') {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'Only SYSTEM_ADMIN or EXECUTIVE_DIRECTOR may trigger the reminder sweep.' });
    }
    const overdueReminders = await this.payments.generateOverdueReminders();
    return { overdueReminders };
  }

  @Get(':id')
  @RequirePermission('payments', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const payment = await this.payments.getById(actor, id);
    return this.redact(payment, actor.roleCode);
  }

  @Post(':id/record')
  @RequirePermission('payments', 'record')
  @Audit('EDIT')
  @Idempotent()
  async record(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    const actor = requirePrincipal(principal);
    await this.payments.getById(actor, id); // scope check before writing
    const payment = await this.payments.recordPayment(id, dto);
    return this.redact(payment, actor.roleCode);
  }

  @Post(':id/refund')
  @RequirePermission('payments', 'refund')
  @Audit('EDIT')
  @Idempotent()
  async refund(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto) {
    const actor = requirePrincipal(principal);
    await this.payments.getById(actor, id);
    const payment = await this.payments.refund(actor, id, dto);
    return this.redact(payment, actor.roleCode);
  }

  @Post(':id/waive')
  @RequirePermission('payments', 'waive')
  @Audit('EDIT')
  async waive(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WaivePaymentDto) {
    const actor = requirePrincipal(principal);
    await this.payments.getById(actor, id);
    const payment = await this.payments.waive(actor, id, dto);
    return this.redact(payment, actor.roleCode);
  }

  private redact(payment: PaymentWithComputed, roleCode: string) {
    const redacted = this.fieldPolicy.redactPayment(payment, roleCode);
    return { ...redacted, outstandingAmount: payment.outstandingAmount, isOverdue: payment.isOverdue };
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
