import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Student } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const SORTABLE_FIELDS = ['createdAt', 'fullName', 'studentCode'] as const;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
  ) {}

  async list(principal: Principal, query: StudentQueryDto): Promise<PaginatedResult<Student>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    /// Phase 13 fix: scope filter and search filter must never be flat-spread into the same
    /// `Prisma.StudentWhereInput` — `studentListFilter`'s OWN_STUDENT case returns a
    /// top-level `OR` key, and the search clause below also produces a top-level `OR` key,
    /// so spreading both let `search` silently overwrite (not narrow) the scope filter —
    /// letting a STUDENT_PARENT enumerate every student in the system via `?search=`.
    /// Combining every fragment under `AND` composes safely regardless of each fragment's
    /// internal shape.
    const where: Prisma.StudentWhereInput = {
      archivedAt: null,
      AND: [
        this.scope.studentListFilter(principal),
        ...(query.targetCountry ? [{ targetCountry: query.targetCountry.toUpperCase() }] : []),
        ...(query.search
          ? [
              {
                OR: [
                  { fullName: { contains: query.search, mode: 'insensitive' as const } },
                  { email: { contains: query.search, mode: 'insensitive' as const } },
                  { studentCode: { contains: query.search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: { [field]: direction },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  /// Every record-level read/write funnels through this: 404 (not a partial 403) when the
  /// record exists but is outside `principal`'s scope — see ScopePolicyService for why.
  async getById(principal: Principal, id: string): Promise<Student> {
    await this.scope.assertStudentAccessible(principal, id);
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student || student.archivedAt) {
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: `Student ${id} not found.` });
    }
    return student;
  }

  /// Duplicate-detection on convert-from-lead (SRS 6.2: match email/phone/name+DOB, ask
  /// staff to confirm merge) is Lead-conversion business logic owned by Phase 04
  /// (04-core-crm/01_LEAD.md), not this generic CRUD scaffold — out of scope here.
  async create(dto: CreateStudentDto): Promise<Student> {
    const studentCode = await this.idGenerator.nextYearlyCode('HS');
    return this.prisma.student.create({
      data: {
        studentCode,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        email: dto.email,
        phone: dto.phone,
        targetCountry: dto.targetCountry?.toUpperCase(),
        targetMajor: dto.targetMajor,
        targetIntake: dto.targetIntake,
        budget: dto.budget,
        budgetCurrency: dto.budgetCurrency,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateStudentDto): Promise<Student> {
    await this.getById(principal, id);
    return this.prisma.student.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        email: dto.email,
        phone: dto.phone,
        targetCountry: dto.targetCountry?.toUpperCase(),
        targetMajor: dto.targetMajor,
        targetIntake: dto.targetIntake,
        budget: dto.budget,
        budgetCurrency: dto.budgetCurrency,
      },
    });
  }

  /// ARCHIVE (03-security/02_RBAC.md action list), never a hard DELETE (Hard Rule #5) —
  /// there is no `delete()` method on this service at all.
  async archive(principal: Principal, id: string): Promise<Student> {
    await this.getById(principal, id);
    return this.prisma.student.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /// EXPORT (03-security/02_RBAC.md action list). Row count is returned to the caller so
  /// the controller can put it in the audit record (SRS 6.21 "Export phải có... row
  /// count, fields exported") — the AuditInterceptor doesn't know the row count of an
  /// arbitrary response body, so it's surfaced explicitly here.
  async export(principal: Principal): Promise<{ rows: Student[]; rowCount: number }> {
    const where: Prisma.StudentWhereInput = { archivedAt: null, ...this.scope.studentListFilter(principal) };
    const rows = await this.prisma.student.findMany({ where, orderBy: { createdAt: 'desc' } });
    return { rows, rowCount: rows.length };
  }
}
