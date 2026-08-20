import { Injectable, NotFoundException } from '@nestjs/common';
import { Activity } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<Activity[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.activity.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<Activity> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateActivityDto): Promise<Activity> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const record = await this.prisma.activity.create({
      data: {
        caseId,
        organization: dto.organization,
        role: dto.role,
        category: dto.category,
        description: dto.description,
        hours: dto.hours,
        impact: dto.impact,
        verifierName: dto.verifierName,
        evidenceDocumentId: dto.evidenceDocumentId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
    return record;
  }

  async update(principal: Principal, id: string, dto: UpdateActivityDto): Promise<Activity> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        organization: dto.organization,
        role: dto.role,
        category: dto.category,
        description: dto.description,
        hours: dto.hours,
        impact: dto.impact,
        verifierName: dto.verifierName,
        evidenceDocumentId: dto.evidenceDocumentId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);
    return updated;
  }

  async verify(principal: Principal, id: string): Promise<Activity> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return this.prisma.activity.update({ where: { id }, data: { verifiedById: principal.userId, verifiedAt: new Date() } });
  }

  private async findOrThrow(id: string): Promise<Activity> {
    const record = await this.prisma.activity.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'ACTIVITY_NOT_FOUND', message: `Activity ${id} not found.` });
    return record;
  }
}
