import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, University } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { ExternalUniversityRecord } from '../../../common/integrations/external-school-data-provider.interface';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateUniversityDto } from './dto/create-university.dto';
import { UniversityQueryDto } from './dto/university-query.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';

const SORTABLE_FIELDS = ['officialName', 'countryCode', 'createdAt', 'lastVerifiedAt'] as const;

/// 08-admission/01_MASTER_DATA.md. GLOBAL master data — gated purely by the
/// `admission_master` permission grant, no per-record scope check, same pattern as
/// `ContractTemplate`/`TaskTemplate` (a shared catalog every authorized role reads the
/// same rows from, not a Student/Case-scoped record). "Không duplicate University chỉ vì
/// nhiều Program/Application/Student/intake/Partner Program" — one row shared by every
/// Program/Application/UniversityChoice that references it via FK, never copied.
@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async list(query: UniversityQueryDto): Promise<PaginatedResult<University>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'officialName', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.UniversityWhereInput = {
      ...(query.countryCode ? { countryCode: query.countryCode.toUpperCase() } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { officialName: { contains: query.search, mode: 'insensitive' } },
              { universityCode: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.university.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.university.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<University> {
    return this.findOrThrow(id);
  }

  /// "Kiểm tra duplicate University" (08-admission/01_MASTER_DATA.md MASTER DATA
  /// INTEGRITY) — same (official name, country) combination rejected as
  /// `DUPLICATE_UNIVERSITY`, case-insensitive (a data-entry retype with different casing
  /// is still the same university).
  async create(dto: CreateUniversityDto): Promise<University> {
    await this.assertNoDuplicate(dto.officialName, dto.countryCode);
    const universityCode = await this.idGenerator.nextYearlyCode('UNI');
    return this.prisma.university.create({
      data: {
        universityCode,
        officialName: dto.officialName,
        countryCode: dto.countryCode.toUpperCase(),
        city: dto.city,
        campus: dto.campus,
        website: dto.website,
        admissionsUrl: dto.admissionsUrl,
        status: dto.status,
        ownerId: dto.ownerId,
        source: dto.source,
      },
    });
  }

  async update(id: string, dto: UpdateUniversityDto): Promise<University> {
    const existing = await this.findOrThrow(id);
    const nextName = dto.officialName ?? existing.officialName;
    const nextCountry = (dto.countryCode ?? existing.countryCode).toUpperCase();
    if (dto.officialName !== undefined || dto.countryCode !== undefined) {
      await this.assertNoDuplicate(nextName, nextCountry, id);
    }
    return this.prisma.university.update({
      where: { id },
      data: {
        officialName: dto.officialName,
        countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : undefined,
        city: dto.city,
        campus: dto.campus,
        website: dto.website,
        admissionsUrl: dto.admissionsUrl,
        status: dto.status,
        ownerId: dto.ownerId,
        source: dto.source,
      },
    });
  }

  /// Records verification without touching any other field — "Source/verification fields
  /// có thể có permission riêng" (08-admission RBAC section), gated by its own
  /// `admission_master:verify` permission at the controller level.
  async verify(id: string): Promise<University> {
    await this.findOrThrow(id);
    return this.prisma.university.update({ where: { id }, data: { lastVerifiedAt: new Date() } });
  }

  /// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "External data ... Không silently
  /// overwrite manually verified data"). Matched by `externalId` ONLY — never by name, and
  /// never creates a new row (a sync source with an unrecognized `externalId` is skipped,
  /// not inserted, to keep "Không duplicate University" absolute even under sync). A row is
  /// skipped (marked `MANUAL_OVERRIDE` instead of overwritten) whenever `lastVerifiedAt` is
  /// newer than the row's own `retrievedAt` — a staff member verified it more recently than
  /// the last sync, so the sync must not silently clobber that human judgment.
  async syncExternal(records: ExternalUniversityRecord[]): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;
    for (const record of records) {
      const existing = await this.prisma.university.findFirst({ where: { externalId: record.externalId } });
      if (!existing) {
        skipped += 1;
        continue;
      }
      const verifiedAfterLastSync = existing.lastVerifiedAt && (!existing.retrievedAt || existing.lastVerifiedAt > existing.retrievedAt);
      if (verifiedAfterLastSync) {
        await this.prisma.university.update({ where: { id: existing.id }, data: { syncStatus: 'MANUAL_OVERRIDE' } });
        skipped += 1;
        continue;
      }
      await this.prisma.university.update({
        where: { id: existing.id },
        data: {
          officialName: record.officialName ?? existing.officialName,
          website: record.website ?? existing.website,
          admissionsUrl: record.admissionsUrl ?? existing.admissionsUrl,
          sourceUrl: record.sourceUrl,
          retrievedAt: new Date(),
          syncStatus: 'SYNCED',
        },
      });
      synced += 1;
    }
    return { synced, skipped };
  }

  private async assertNoDuplicate(officialName: string, countryCode: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.university.findFirst({
      where: {
        officialName: { equals: officialName, mode: 'insensitive' },
        countryCode: countryCode.toUpperCase(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_UNIVERSITY',
        message: `A university named "${officialName}" already exists for country ${countryCode.toUpperCase()} (${existing.universityCode}).`,
        existingUniversityId: existing.id,
      });
    }
  }

  private async findOrThrow(id: string): Promise<University> {
    const university = await this.prisma.university.findUnique({ where: { id } });
    if (!university) throw new NotFoundException({ code: 'UNIVERSITY_NOT_FOUND', message: `University ${id} not found.` });
    return university;
  }
}
