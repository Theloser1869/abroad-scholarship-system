import { Injectable, NotFoundException } from '@nestjs/common';
import { VisaChecklistItem } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateVisaChecklistItemDto } from './dto/create-visa-checklist-item.dto';
import { UpdateVisaChecklistItemDto } from './dto/update-visa-checklist-item.dto';

const RESOLVED_STATUSES = ['DONE', 'WAIVED'];

/// `VisaChecklistItem` rows with `entityType = 'Visa'` — manually-added items beyond the
/// ones `VisasService.create` instantiated from active templates. Real Document FK, same
/// grant-on-link pattern as every other Phase 07/08 evidence field.
@Injectable()
export class VisaChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForVisa(principal: Principal, visaId: string): Promise<VisaChecklistItem[]> {
    const visa = await this.findVisaOrThrow(visaId);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    return this.prisma.visaChecklistItem.findMany({ where: { entityType: 'Visa', entityId: visaId }, orderBy: { createdAt: 'asc' } });
  }

  async create(principal: Principal, visaId: string, dto: CreateVisaChecklistItemDto): Promise<VisaChecklistItem> {
    const visa = await this.findVisaOrThrow(visaId);
    await this.scope.assertCaseAccessible(principal, visa.caseId);
    const item = await this.prisma.visaChecklistItem.create({
      data: {
        entityType: 'Visa',
        entityId: visaId,
        title: dto.title,
        required: dto.required,
        ownerId: dto.ownerId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, visa.caseId, { viewOnlyForRoles: ['CONSULTANT'] });
    return item;
  }

  async update(principal: Principal, id: string, dto: UpdateVisaChecklistItemDto): Promise<VisaChecklistItem> {
    const item = await this.findItemOrThrow(id);
    const visa = await this.findVisaOrThrow(item.entityId);
    await this.scope.assertCaseAccessible(principal, visa.caseId);

    const nextStatus = dto.status ?? item.status;
    const updated = await this.prisma.visaChecklistItem.update({
      where: { id },
      data: {
        title: dto.title,
        required: dto.required,
        ownerId: dto.ownerId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
        completedAt: RESOLVED_STATUSES.includes(nextStatus) ? (item.completedAt ?? new Date()) : null,
      },
    });
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, visa.caseId, { viewOnlyForRoles: ['CONSULTANT'] });
    return updated;
  }

  private async findVisaOrThrow(visaId: string) {
    const visa = await this.prisma.visa.findUnique({ where: { id: visaId } });
    if (!visa) throw new NotFoundException({ code: 'VISA_NOT_FOUND', message: `Visa ${visaId} not found.` });
    return visa;
  }

  private async findItemOrThrow(id: string): Promise<VisaChecklistItem> {
    const item = await this.prisma.visaChecklistItem.findUnique({ where: { id } });
    if (!item || item.entityType !== 'Visa') throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: `Checklist item ${id} not found.` });
    return item;
  }
}
