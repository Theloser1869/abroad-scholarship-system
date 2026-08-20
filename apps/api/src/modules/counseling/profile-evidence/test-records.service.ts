import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TestRecord } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateTestRecordDto } from './dto/create-test-record.dto';
import { UpdateTestRecordDto } from './dto/update-test-record.dto';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/// 07-profile/02_PROFILE_EVIDENCE.md "Một Student có thể có nhiều attempt. Không overwrite
/// attempt trước" — each `(caseId, testType, attemptNumber)` is its own permanent row
/// (DB unique constraint); a new attempt is always `create`, never a `create`-over-existing.
@Injectable()
export class TestRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<TestRecord[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.testRecord.findMany({ where: { caseId }, orderBy: [{ testType: 'asc' }, { attemptNumber: 'asc' }] });
  }

  async getById(principal: Principal, id: string): Promise<TestRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return record;
  }

  async create(principal: Principal, caseId: string, dto: CreateTestRecordDto): Promise<TestRecord> {
    await this.scope.assertCaseAccessible(principal, caseId);
    try {
      const record = await this.prisma.testRecord.create({
        data: {
          caseId,
          testType: dto.testType,
          attemptNumber: dto.attemptNumber,
          testDate: dto.testDate ? new Date(dto.testDate) : undefined,
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
          score: dto.score,
          subscores: dto.subscores as never,
          target: dto.target,
          evidenceDocumentId: dto.evidenceDocumentId,
        },
      });
      if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, caseId);
      return record;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictException({ code: 'DUPLICATE_TEST_ATTEMPT', message: `Attempt ${dto.attemptNumber} of ${dto.testType} already exists for this case.` });
      }
      throw err;
    }
  }

  async update(principal: Principal, id: string, dto: UpdateTestRecordDto): Promise<TestRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    const updated = await this.prisma.testRecord.update({
      where: { id },
      data: {
        testDate: dto.testDate ? new Date(dto.testDate) : undefined,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        score: dto.score,
        subscores: dto.subscores as never,
        target: dto.target,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, record.caseId);
    return updated;
  }

  async verify(principal: Principal, id: string): Promise<TestRecord> {
    const record = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, record.caseId);
    return this.prisma.testRecord.update({ where: { id }, data: { verifiedById: principal.userId, verifiedAt: new Date() } });
  }

  private async findOrThrow(id: string): Promise<TestRecord> {
    const record = await this.prisma.testRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'TEST_RECORD_NOT_FOUND', message: `Test record ${id} not found.` });
    return record;
  }
}
