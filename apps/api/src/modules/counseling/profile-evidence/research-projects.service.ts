import { Injectable, NotFoundException } from '@nestjs/common';
import { ResearchProject } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateResearchProjectDto } from './dto/create-research-project.dto';
import { UpdateResearchProjectDto } from './dto/update-research-project.dto';

@Injectable()
export class ResearchProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<ResearchProject[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.researchProject.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<ResearchProject> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateResearchProjectDto): Promise<ResearchProject> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const researchCode = await this.idGenerator.nextYearlyCode('RES');
    const record = await this.prisma.researchProject.create({
      data: { caseId, researchCode, title: dto.title, mentor: dto.mentor, role: dto.role, methodology: dto.methodology, output: dto.output, publication: dto.publication, award: dto.award, evidenceDocumentId: dto.evidenceDocumentId, startAt: dto.startAt ? new Date(dto.startAt) : undefined, endAt: dto.endAt ? new Date(dto.endAt) : undefined },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
    return record;
  }

  async update(principal: Principal, id: string, dto: UpdateResearchProjectDto): Promise<ResearchProject> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    const updated = await this.prisma.researchProject.update({
      where: { id },
      data: { title: dto.title, mentor: dto.mentor, role: dto.role, methodology: dto.methodology, output: dto.output, publication: dto.publication, award: dto.award, evidenceDocumentId: dto.evidenceDocumentId, startAt: dto.startAt ? new Date(dto.startAt) : undefined, endAt: dto.endAt ? new Date(dto.endAt) : undefined },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);
    return updated;
  }

  private async findOrThrow(id: string): Promise<ResearchProject> {
    const record = await this.prisma.researchProject.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'RESEARCH_PROJECT_NOT_FOUND', message: `Research project ${id} not found.` });
    return record;
  }
}
