import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Enrollment } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { ConfirmEnrollmentDto } from './dto/confirm-enrollment.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

/// 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md. "Enrollment là transaction của Student/Case,
/// không phải master entity." Multiple Enrollment rows may exist per Case (history of
/// attempts — "Nếu business rule cho phép nhiều enrollment attempts: thiết kế history rõ
/// ràng"); at most one CONFIRMED at a time is a service-layer check
/// (`assertNoActiveConfirmed`), same "at most one active X" precedent as Visa/Application.
@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<Enrollment[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.enrollment.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<Enrollment> {
    const enrollment = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, enrollment.caseId);
    return enrollment;
  }

  /// "Không cho Enrollment target một Offer không hợp lệ khi business rule cấm" — the
  /// Offer must belong to this Case (via its Application) and be ACCEPTED; DECLINED/
  /// EXPIRED/WITHDRAWN/RECEIVED offers are all rejected as invalid targets.
  /// `universityId`/`programId` are derived from the offer's Application, never
  /// separately client-supplied — "Không duplicate University/Program."
  async create(principal: Principal, caseId: string, dto: CreateEnrollmentDto): Promise<Enrollment> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const caseRecord = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${caseId} not found.` });

    const offer = await this.prisma.offer.findUnique({ where: { id: dto.offerId }, include: { application: true } });
    if (!offer || offer.application.caseId !== caseId) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: `Offer ${dto.offerId} not found for this case.` });
    }
    if (offer.status !== 'ACCEPTED') {
      throw new ConflictException({
        code: 'INVALID_ENROLLMENT_TARGET',
        message: `Offer ${dto.offerId} is ${offer.status} — only an ACCEPTED offer may be enrolled against.`,
      });
    }

    const program = await this.prisma.program.findUniqueOrThrow({ where: { id: offer.application.programId } });
    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: caseRecord.studentId,
        caseId,
        offerId: dto.offerId,
        universityId: program.universityId,
        programId: program.id,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
    return enrollment;
  }

  async update(principal: Principal, id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const enrollment = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, enrollment.caseId);
    if (enrollment.status === 'WITHDRAWN') {
      throw new ConflictException({ code: 'ENROLLMENT_WITHDRAWN', message: 'A withdrawn enrollment cannot be edited.' });
    }
    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        evidenceDocumentId: dto.evidenceDocumentId,
        internalNotes: dto.internalNotes,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, enrollment.caseId);
    return updated;
  }

  /// PLANNED -> CONFIRMED. "Nếu chỉ có một confirmed enrollment: có constraint/business
  /// rule thích hợp" — rejects if another CONFIRMED enrollment already exists for this
  /// Case.
  async confirm(principal: Principal, id: string, dto: ConfirmEnrollmentDto): Promise<Enrollment> {
    const enrollment = await this.requireStatus(principal, id, ['PLANNED']);
    await this.assertNoActiveConfirmed(enrollment.caseId);
    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmationDate: dto.confirmationDate ? new Date(dto.confirmationDate) : new Date(),
        evidenceDocumentId: dto.evidenceDocumentId ?? enrollment.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, enrollment.caseId);
    return updated;
  }

  async withdraw(principal: Principal, id: string): Promise<Enrollment> {
    await this.requireStatus(principal, id, ['PLANNED', 'CONFIRMED']);
    return this.prisma.enrollment.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }

  private async assertNoActiveConfirmed(caseId: string): Promise<void> {
    const existing = await this.prisma.enrollment.findFirst({ where: { caseId, status: 'CONFIRMED' } });
    if (existing) {
      throw new ConflictException({
        code: 'CONFIRMED_ENROLLMENT_EXISTS',
        message: `This case already has a confirmed enrollment (${existing.id}) — withdraw it before confirming another.`,
        existingEnrollmentId: existing.id,
      });
    }
  }

  private async requireStatus(principal: Principal, id: string, allowed: string[]): Promise<Enrollment> {
    const enrollment = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, enrollment.caseId);
    if (!allowed.includes(enrollment.status)) {
      throw new ConflictException({
        code: 'INVALID_ENROLLMENT_STATE',
        message: `This action requires status in [${allowed.join(', ')}], but the enrollment is ${enrollment.status}.`,
      });
    }
    return enrollment;
  }

  private async findOrThrow(id: string): Promise<Enrollment> {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id } });
    if (!enrollment) throw new NotFoundException({ code: 'ENROLLMENT_NOT_FOUND', message: `Enrollment ${id} not found.` });
    return enrollment;
  }
}
