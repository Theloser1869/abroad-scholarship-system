import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CancelCommissionTransactionDto } from './dto/cancel-commission-transaction.dto';
import { CommissionTransactionQueryDto } from './dto/commission-transaction-query.dto';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { PayCommissionTransactionDto } from './dto/pay-commission-transaction.dto';
import { UpdateCommissionTransactionLinkageDto } from './dto/update-commission-transaction-linkage.dto';
import { CommissionTransactionsService } from './commission-transactions.service';

@Controller('partners/:partnerId/commission-transactions')
export class CommissionTransactionsNestedController {
  constructor(private readonly service: CommissionTransactionsService) {}

  @Get()
  @RequirePermission('commission_transactions', 'view')
  async list(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Query() query: CommissionTransactionQueryDto) {
    return this.service.listForPartner(partnerId, query);
  }

  @Post()
  @RequirePermission('commission_transactions', 'create')
  @Audit('CREATE')
  async create(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Body() dto: CreateCommissionTransactionDto) {
    return this.service.create(partnerId, dto);
  }
}

@Controller('commission-transactions')
export class CommissionTransactionsController {
  constructor(private readonly service: CommissionTransactionsService) {}

  @Get()
  @RequirePermission('commission_transactions', 'view')
  async list(@Query() query: CommissionTransactionQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission('commission_transactions', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async updateLinkage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommissionTransactionLinkageDto) {
    return this.service.updateLinkage(id, dto);
  }

  @Post(':id/confirm-eligibility')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async confirmEligibility(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.confirmEligibility(id);
  }

  @Post(':id/calculate')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async calculate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.calculate(id);
  }

  @Post(':id/approve')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approve(id);
  }

  @Post(':id/mark-payable')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async markPayable(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.markPayable(id);
  }

  @Post(':id/pay')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayCommissionTransactionDto) {
    return this.service.pay(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('commission_transactions', 'edit')
  @Audit('EDIT')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelCommissionTransactionDto) {
    return this.service.cancel(id, dto);
  }
}
