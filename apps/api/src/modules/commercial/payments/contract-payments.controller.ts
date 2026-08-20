import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Idempotent } from '../../../common/idempotency/idempotency.interceptor';
import { FieldPolicyService } from '../../identity/rbac/field-policy.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentsService, PaymentWithComputed } from './payments.service';

/// The payment schedule is a sub-resource of its Contract (05-commercial/02_PAYMENT.md
/// "nhiều installment thuộc một Contract") — nested under `/contracts/:contractId/payments`,
/// distinct from the flat `/payments/:id` actions in `PaymentsController`.
@Controller('contracts/:contractId/payments')
export class ContractPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly fieldPolicy: FieldPolicyService,
  ) {}

  @Get()
  @RequirePermission('payments', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('contractId', ParseUUIDPipe) contractId: string, @Query() query: PaymentQueryDto) {
    const actor = requirePrincipal(principal);
    const result = await this.payments.listForContract(actor, contractId, query);
    return { data: result.data.map((row) => this.redact(row, actor.roleCode)), meta: result.meta };
  }

  @Post()
  @RequirePermission('payments', 'create')
  @Audit('CREATE')
  @Idempotent()
  async create(@CurrentUser() principal: Principal | null, @Param('contractId', ParseUUIDPipe) contractId: string, @Body() dto: CreatePaymentDto) {
    const actor = requirePrincipal(principal);
    await this.payments.assertContractAccessible(actor, contractId); // scope check before writing
    const payment = await this.payments.createInstallment(contractId, dto);
    return this.redact(this.payments.withComputed(payment), actor.roleCode);
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
