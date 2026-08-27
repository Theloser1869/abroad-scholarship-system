import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SchoolMaster } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateSchoolMasterDto } from './dto/create-school-master.dto';
import { UpdateSchoolMasterDto } from './dto/update-school-master.dto';

/// Client Acceptance Remediation DEC-05(b) (2026-08-27) — a curated, staff-maintained school
/// list for `AcademicRecord.school` to optionally link against. Deliberately minimal: no
/// business-code ID, no external-sync fields (unlike `admission/master-data`'s University/
/// Program/ScholarshipMaster, which is a different, client-grouped domain).
@Injectable()
export class SchoolMastersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string): Promise<SchoolMaster[]> {
    return this.prisma.schoolMaster.findMany({
      where: { status: 'ACTIVE', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async create(dto: CreateSchoolMasterDto): Promise<SchoolMaster> {
    const existing = await this.prisma.schoolMaster.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' } } });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_SCHOOL_MASTER',
        message: `A school named "${dto.name}" already exists.`,
        existingSchoolMasterId: existing.id,
      });
    }
    return this.prisma.schoolMaster.create({ data: { name: dto.name } });
  }

  async update(id: string, dto: UpdateSchoolMasterDto): Promise<SchoolMaster> {
    await this.findOrThrow(id);
    if (dto.name) {
      const existing = await this.prisma.schoolMaster.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } } });
      if (existing) {
        throw new ConflictException({
          code: 'DUPLICATE_SCHOOL_MASTER',
          message: `A school named "${dto.name}" already exists.`,
          existingSchoolMasterId: existing.id,
        });
      }
    }
    return this.prisma.schoolMaster.update({ where: { id }, data: { name: dto.name, status: dto.status } });
  }

  private async findOrThrow(id: string): Promise<SchoolMaster> {
    const record = await this.prisma.schoolMaster.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 'SCHOOL_MASTER_NOT_FOUND', message: `School master ${id} not found.` });
    return record;
  }
}
