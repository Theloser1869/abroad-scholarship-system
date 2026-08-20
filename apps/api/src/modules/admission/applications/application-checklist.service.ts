import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationChecklist } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

const RESOLVED_STATUSES = ['DONE', 'WAIVED'];

/// 08-admission/02_APPLICATION.md checklist field list. `documentId` is a real FK into the
/// existing Document subsystem (Phase 07 ASM-24 precedent) — no separate
/// ApplicationFile/storage model. Mandatory-item completion is enforced server-side by
/// `ApplicationsService.submit`, not here — this service only manages individual items.
@Injectable()
export class ApplicationChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForApplication(principal: Principal, applicationId: string): Promise<ApplicationChecklist[]> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    return this.prisma.applicationChecklist.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } });
  }

  async create(principal: Principal, applicationId: string, dto: CreateChecklistItemDto): Promise<ApplicationChecklist> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    const item = await this.prisma.applicationChecklist.create({
      data: {
        applicationId,
        title: dto.title,
        required: dto.required,
        ownerId: dto.ownerId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, application.caseId);
    return item;
  }

  async update(principal: Principal, id: string, dto: UpdateChecklistItemDto): Promise<ApplicationChecklist> {
    const item = await this.findOrThrow(id);
    const application = await this.findApplicationOrThrow(item.applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);

    const nextStatus = dto.status ?? item.status;
    const updated = await this.prisma.applicationChecklist.update({
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
    if (dto.documentId) await this.documents.grantCaseAccess(dto.documentId, application.caseId);
    return updated;
  }

  /// Phase 11 (Portal) — "Nếu Student được upload application documents: sử dụng Document
  /// subsystem. Authorization phải kiểm tra Student ownership/relationship." Deliberately
  /// narrower than `update()` above: only ever writes `documentId`, never `status`/`title`/
  /// `required`/`ownerId`/`deadline` — a student attaching evidence does not thereby mark
  /// the item DONE/WAIVED (that stays a staff review call via the regular endpoint), and
  /// "Không cho Student tự chuyển Application sang Submitted/Offer/Reject" extends to every
  /// checklist sub-status, not just the top-level Application FSM.
  async submitEvidence(caseId: string, checklistItemId: string, documentId: string): Promise<ApplicationChecklist> {
    const item = await this.findOrThrow(checklistItemId);
    const application = await this.findApplicationOrThrow(item.applicationId);
    if (application.caseId !== caseId) {
      throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: `Checklist item ${checklistItemId} not found.` });
    }
    const updated = await this.prisma.applicationChecklist.update({ where: { id: checklistItemId }, data: { documentId } });
    await this.documents.grantCaseAccess(documentId, caseId);
    return updated;
  }

  private async findApplicationOrThrow(applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${applicationId} not found.` });
    return application;
  }

  private async findOrThrow(id: string): Promise<ApplicationChecklist> {
    const item = await this.prisma.applicationChecklist.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'CHECKLIST_ITEM_NOT_FOUND', message: `Checklist item ${id} not found.` });
    return item;
  }
}
