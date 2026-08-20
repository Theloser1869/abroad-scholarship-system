import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Offer } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { ApplicationsService } from '../applications/applications.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';

/// 08-admission/03_OFFER_SCHOLARSHIP.md. Belongs to exactly one Application; an
/// Application may carry multiple Offer rows over time — a revised/renegotiated offer is a
/// NEW row, the prior one's row is never edited into it ("một Application có nhiều offer...
/// không overwrite offer lịch sử"). "Active/current offer" is a computed read
/// (`getCurrent`), not a stored flag — same "computed, not synced" precedent as
/// `TasksService.isOverdue`/`PaymentsService`'s lazy OVERDUE sweep (applied here to
/// RECEIVED→EXPIRED).
@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
    private readonly applications: ApplicationsService,
  ) {}

  async listForApplication(principal: Principal, applicationId: string): Promise<Offer[]> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    await this.syncExpired(applicationId);
    return this.prisma.offer.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<Offer> {
    const offer = await this.findOrThrow(id);
    const application = await this.findApplicationOrThrow(offer.applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    await this.syncExpired(offer.applicationId);
    return this.findOrThrow(id);
  }

  /// "Không được chuyển Offer nếu chưa có offer record tương ứng" — the only path that can
  /// move the parent Application's status to OFFER (`ApplicationsService.transitionToOffer`).
  async create(principal: Principal, applicationId: string, dto: CreateOfferDto): Promise<Offer> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    if (application.status !== 'SUBMITTED' && application.status !== 'WAITLIST' && application.status !== 'OFFER') {
      throw new ConflictException({
        code: 'OFFER_REQUIRES_SUBMITTED_APPLICATION',
        message: `An Offer can only be recorded once the Application is SUBMITTED or WAITLIST, not ${application.status}.`,
      });
    }

    const offer = await this.prisma.offer.create({
      data: {
        applicationId,
        offerType: dto.offerType,
        offerDate: dto.offerDate ? new Date(dto.offerDate) : undefined,
        acceptanceDeadline: dto.acceptanceDeadline ? new Date(dto.acceptanceDeadline) : undefined,
        depositAmount: dto.depositAmount,
        depositCurrency: dto.depositCurrency,
        isConditional: dto.isConditional,
        conditions: dto.conditions,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, application.caseId);
    await this.applications.transitionToOffer(applicationId);
    return offer;
  }

  async respond(principal: Principal, id: string, dto: RespondOfferDto): Promise<Offer> {
    const offer = await this.findOrThrow(id);
    const application = await this.findApplicationOrThrow(offer.applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    await this.syncExpired(offer.applicationId);

    const current = await this.findOrThrow(id);
    if (current.status !== 'RECEIVED') {
      throw new ConflictException({
        code: 'INVALID_OFFER_STATE',
        message: `This offer is ${current.status} and can no longer be responded to.`,
      });
    }
    return this.prisma.offer.update({
      where: { id },
      data: { status: dto.decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
    });
  }

  /// "Rule rõ ràng cho active/current offer": the ACCEPTED offer if one exists, else the
  /// most recently received non-expired offer, else null.
  async getCurrent(principal: Principal, applicationId: string): Promise<Offer | null> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.scope.assertCaseAccessible(principal, application.caseId);
    await this.syncExpired(applicationId);

    const accepted = await this.prisma.offer.findFirst({ where: { applicationId, status: 'ACCEPTED' }, orderBy: { respondedAt: 'desc' } });
    if (accepted) return accepted;
    return this.prisma.offer.findFirst({ where: { applicationId, status: 'RECEIVED' }, orderBy: { createdAt: 'desc' } });
  }

  /// Lazily flips RECEIVED offers past `acceptanceDeadline` into EXPIRED on read — same
  /// pattern as `PaymentsService`'s PENDING/PARTIALLY_PAID → OVERDUE sweep.
  private async syncExpired(applicationId: string): Promise<void> {
    await this.prisma.offer.updateMany({
      where: { applicationId, status: 'RECEIVED', acceptanceDeadline: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async findApplicationOrThrow(applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND', message: `Application ${applicationId} not found.` });
    return application;
  }

  private async findOrThrow(id: string): Promise<Offer> {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: `Offer ${id} not found.` });
    return offer;
  }
}
