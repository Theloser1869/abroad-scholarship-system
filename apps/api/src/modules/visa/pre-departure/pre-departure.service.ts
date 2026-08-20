import { Injectable, NotFoundException } from '@nestjs/common';
import { VisaChecklistItem } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreatePreDepartureItemDto } from './dto/create-pre-departure-item.dto';
import { UpdatePreDepartureItemDto } from './dto/update-pre-departure-item.dto';

const RESOLVED_STATUSES = ['DONE', 'WAIVED'];

/// 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md. `VisaChecklistItem` rows with
/// `entityType = 'PreDeparture'`, `entityId = caseId` — a Case-level milestone that
/// outlives any one Visa attempt, not attached to a specific Visa row. "Không cho phép
/// hoàn tất pre-departure nếu mandatory item chưa hoàn thành" is enforced where it
/// actually matters — at Case Closure (`VisaStatusService.hasIncompletePreDepartureChecklist`,
/// called from `CasesService.close()`) — rather than a separate synthetic "pre-departure
/// complete" flag with no other purpose; see docs/ASSUMPTIONS.md.
@Injectable()
export class PreDepartureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<VisaChecklistItem[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.visaChecklistItem.findMany({ where: { entityType: 'PreDeparture', entityId: caseId }, orderBy: { createdAt: 'asc' } });
  }

  async create(principal: Principal, caseId: string, dto: CreatePreDepartureItemDto): Promise<VisaChecklistItem> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` });

    const item = await this.prisma.visaChecklistItem.create({
      data: {
        entityType: 'PreDeparture',
        entityId: caseId,
        title: dto.title,
        category: dto.category,
        required: dto.required,
        ownerId: dto.ownerId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, caseId);
    return item;
  }

  async update(principal: Principal, id: string, dto: UpdatePreDepartureItemDto): Promise<VisaChecklistItem> {
    const item = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, item.entityId);

    const nextStatus = dto.status ?? item.status;
    const updated = await this.prisma.visaChecklistItem.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        required: dto.required,
        ownerId: dto.ownerId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
        completedAt: RESOLVED_STATUSES.includes(nextStatus) ? (item.completedAt ?? new Date()) : null,
      },
    });
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, item.entityId);
    return updated;
  }

  private async findOrThrow(id: string): Promise<VisaChecklistItem> {
    const item = await this.prisma.visaChecklistItem.findUnique({ where: { id } });
    if (!item || item.entityType !== 'PreDeparture') throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: `Checklist item ${id} not found.` });
    return item;
  }
}
