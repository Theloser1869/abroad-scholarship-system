import { Injectable, NotFoundException } from '@nestjs/common';
import { Competition } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

/// 07-profile/02_PROFILE_EVIDENCE.md "mỗi participation là một record riêng" — each row is
/// its own independent competition entry, never merged/deduplicated across years.
@Injectable()
export class CompetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<Competition[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.competition.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<Competition> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateCompetitionDto): Promise<Competition> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const competitionCode = await this.idGenerator.nextYearlyCode('COMP');
    const record = await this.prisma.competition.create({ data: { caseId, competitionCode, ...dto } });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
    return record;
  }

  async update(principal: Principal, id: string, dto: UpdateCompetitionDto): Promise<Competition> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    const updated = await this.prisma.competition.update({ where: { id }, data: dto });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);
    return updated;
  }

  private async findOrThrow(id: string): Promise<Competition> {
    const record = await this.prisma.competition.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'COMPETITION_NOT_FOUND', message: `Competition ${id} not found.` });
    return record;
  }
}
