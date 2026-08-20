import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionRule } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CommissionRuleQueryDto } from './dto/commission-rule-query.dto';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

/// 10-partners/01_PARTNER_CRM.md CommissionRule section. Config data — same "no
/// business-ID format, plain UUID" treatment as TaskTemplate/ContractTemplate/
/// VisaChecklistTemplate. Deliberately separate from `CommissionTransaction` (the rule is
/// config, the transaction is a fact) and from `Payment`/`Contract.value`/
/// `ScholarshipApplication.awardAmount` (Hard Rule "Commission phải tách khỏi student
/// payment" — no shared FK/column with any of the three, anywhere).
@Injectable()
export class CommissionRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPartner(partnerId: string, query: CommissionRuleQueryDto): Promise<PaginatedResult<CommissionRule>> {
    await this.assertPartnerExists(partnerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where = {
      partnerId,
      ...(query.partnerProgramId ? { partnerProgramId: query.partnerProgramId } : {}),
      ...(query.basis ? { basis: query.basis } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.commissionRule.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.commissionRule.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<CommissionRule> {
    return this.findOrThrow(id);
  }

  async create(partnerId: string, dto: CreateCommissionRuleDto): Promise<CommissionRule> {
    await this.assertPartnerExists(partnerId);
    if (dto.partnerProgramId) {
      const program = await this.prisma.partnerProgram.findUnique({ where: { id: dto.partnerProgramId } });
      if (!program || program.partnerId !== partnerId) {
        throw new NotFoundException({ code: 'PARTNER_PROGRAM_NOT_FOUND', message: `Partner program ${dto.partnerProgramId} not found for this partner.` });
      }
    }
    this.assertBasisFieldsConsistent(dto.basis, dto.percentageRate, dto.fixedAmount);

    return this.prisma.commissionRule.create({
      data: {
        partnerId,
        partnerProgramId: dto.partnerProgramId,
        basis: dto.basis,
        percentageRate: dto.percentageRate,
        fixedAmount: dto.fixedAmount,
        currency: dto.currency,
        conditions: dto.conditions,
        priority: dto.priority ?? 0,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCommissionRuleDto): Promise<CommissionRule> {
    const rule = await this.findOrThrow(id);
    const basis = dto.basis ?? rule.basis;
    const percentageRate = dto.percentageRate ?? (dto.basis ? undefined : rule.percentageRate?.toNumber());
    const fixedAmount = dto.fixedAmount ?? (dto.basis ? undefined : rule.fixedAmount?.toNumber());
    if (dto.basis || dto.percentageRate !== undefined || dto.fixedAmount !== undefined) {
      this.assertBasisFieldsConsistent(basis, percentageRate, fixedAmount);
    }
    return this.prisma.commissionRule.update({
      where: { id },
      data: {
        partnerProgramId: dto.partnerProgramId,
        basis: dto.basis,
        percentageRate: dto.percentageRate,
        fixedAmount: dto.fixedAmount,
        currency: dto.currency,
        conditions: dto.conditions,
        priority: dto.priority,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        status: dto.status,
      },
    });
  }

  async activate(id: string): Promise<CommissionRule> {
    await this.findOrThrow(id);
    return this.prisma.commissionRule.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async deactivate(id: string): Promise<CommissionRule> {
    await this.findOrThrow(id);
    return this.prisma.commissionRule.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  /// Deterministic precedence when multiple ACTIVE rules could match — no business rule
  /// names one, so this phase documents its own (docs/ASSUMPTIONS.md ASM-44): filter to
  /// ACTIVE rules for this partner, in date window, whose `partnerProgramId` is either an
  /// exact match or partner-wide (null); rank a program-specific rule above a partner-wide
  /// one, then by `priority` (higher wins), then by the most recently created, then by `id`
  /// as a final, fully deterministic tie-break (never random).
  async selectRuleFor(partnerId: string, partnerProgramId: string | undefined, at: Date): Promise<CommissionRule | null> {
    const candidates = await this.prisma.commissionRule.findMany({
      where: {
        partnerId,
        status: 'ACTIVE',
        OR: [{ partnerProgramId: partnerProgramId ?? undefined }, { partnerProgramId: null }],
        AND: [{ OR: [{ effectiveDate: null }, { effectiveDate: { lte: at } }] }, { OR: [{ expiryDate: null }, { expiryDate: { gte: at } }] }],
      },
    });
    if (candidates.length === 0) return null;

    const ranked = [...candidates].sort((a, b) => {
      const specificityDiff = Number(b.partnerProgramId !== null) - Number(a.partnerProgramId !== null);
      if (specificityDiff !== 0) return specificityDiff;
      if (b.priority !== a.priority) return b.priority - a.priority;
      const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;
      return a.id.localeCompare(b.id);
    });
    return ranked[0];
  }

  private assertBasisFieldsConsistent(basis: string, percentageRate: number | undefined, fixedAmount: number | undefined): void {
    if (basis === 'FIXED') {
      if (fixedAmount === undefined || fixedAmount === null) {
        throw new BadRequestException({ code: 'FIXED_AMOUNT_REQUIRED', message: 'fixedAmount is required when basis is FIXED.' });
      }
      if (percentageRate !== undefined && percentageRate !== null) {
        throw new BadRequestException({ code: 'PERCENTAGE_RATE_NOT_ALLOWED', message: 'percentageRate must not be set when basis is FIXED.' });
      }
    } else {
      if (percentageRate === undefined || percentageRate === null) {
        throw new BadRequestException({ code: 'PERCENTAGE_RATE_REQUIRED', message: 'percentageRate is required when basis is CONTRACT_VALUE or PAYMENT_COLLECTED.' });
      }
      if (fixedAmount !== undefined && fixedAmount !== null) {
        throw new BadRequestException({ code: 'FIXED_AMOUNT_NOT_ALLOWED', message: 'fixedAmount must not be set when basis is CONTRACT_VALUE or PAYMENT_COLLECTED.' });
      }
    }
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${partnerId} not found.` });
  }

  private async findOrThrow(id: string): Promise<CommissionRule> {
    const rule = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException({ code: 'COMMISSION_RULE_NOT_FOUND', message: `Commission rule ${id} not found.` });
    return rule;
  }
}
