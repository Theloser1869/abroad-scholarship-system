import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UniversityChoice } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateUniversityChoiceDto } from './dto/create-university-choice.dto';
import { ReviewUniversityChoiceDto } from './dto/review-university-choice.dto';
import { UpdateUniversityChoiceDto } from './dto/update-university-choice.dto';

/// 08-admission/01_MASTER_DATA.md School Selection. `caseId` is nullable (a choice may be
/// proposed during early counseling before a Case formally exists — unlike Application,
/// see schema.prisma's own comment on the model), so scope is checked via whichever FK is
/// actually set: `assertCaseAccessible` when a Case is linked, `assertStudentAccessible`
/// otherwise — both already exist on `ScopePolicyService`, no new scope map needed (same
/// ASM-20 reuse precedent as every Phase 07 Case-scoped entity).
@Injectable()
export class UniversityChoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
  ) {}

  async listForStudent(principal: Principal, studentId: string): Promise<UniversityChoice[]> {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.prisma.universityChoice.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<UniversityChoice> {
    const choice = await this.findOrThrow(id);
    await this.assertAccessible(principal, choice);
    return choice;
  }

  async create(principal: Principal, studentId: string, dto: CreateUniversityChoiceDto): Promise<UniversityChoice> {
    await this.scope.assertStudentAccessible(principal, studentId);

    const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
    if (!program) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: `Program ${dto.programId} not found.` });

    if (dto.caseId) {
      const targetCase = await this.prisma.case.findUnique({ where: { id: dto.caseId } });
      if (!targetCase || targetCase.studentId !== studentId) {
        throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: `Case ${dto.caseId} not found for this student.` });
      }
    }

    const existing = await this.prisma.universityChoice.findUnique({ where: { studentId_programId: { studentId, programId: dto.programId } } });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_UNIVERSITY_CHOICE',
        message: `This student already has a choice for this program (status ${existing.status}).`,
        existingUniversityChoiceId: existing.id,
      });
    }

    return this.prisma.universityChoice.create({
      data: { studentId, caseId: dto.caseId, programId: dto.programId, tier: dto.tier, rationale: dto.rationale, ownerId: dto.ownerId },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateUniversityChoiceDto): Promise<UniversityChoice> {
    const choice = await this.findOrThrow(id);
    await this.assertAccessible(principal, choice);
    return this.prisma.universityChoice.update({
      where: { id },
      data: { tier: dto.tier, rationale: dto.rationale, status: dto.status, ownerId: dto.ownerId },
    });
  }

  /// A dedicated action (not folded into `update`) so "review information" — who reviewed
  /// it and when — is always set together, server-side, never client-suppliable.
  async review(principal: Principal, id: string, dto: ReviewUniversityChoiceDto): Promise<UniversityChoice> {
    const choice = await this.findOrThrow(id);
    await this.assertAccessible(principal, choice);
    return this.prisma.universityChoice.update({
      where: { id },
      data: { reviewedById: principal.userId, reviewedAt: new Date(), reviewNotes: dto.reviewNotes },
    });
  }

  private async assertAccessible(principal: Principal, choice: UniversityChoice): Promise<void> {
    if (choice.caseId) {
      await this.scope.assertCaseAccessible(principal, choice.caseId);
    } else {
      await this.scope.assertStudentAccessible(principal, choice.studentId);
    }
  }

  private async findOrThrow(id: string): Promise<UniversityChoice> {
    const choice = await this.prisma.universityChoice.findUnique({ where: { id } });
    if (!choice) throw new NotFoundException({ code: 'UNIVERSITY_CHOICE_NOT_FOUND', message: `University choice ${id} not found.` });
    return choice;
  }
}
