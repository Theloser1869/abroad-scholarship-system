import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

const SORTABLE_FIELDS = ['createdAt', 'action', 'objectType', 'result'] as const;

/// 03-security/03_AUDIT.md "Build query/filter UI for authorized admins" — this is the
/// query/filter API that UI would call. No frontend app exists in this repository yet at
/// any phase (see docs/ASSUMPTIONS.md ASM-08); the endpoint itself is the deliverable this
/// phase can responsibly ship. Read-only — there is deliberately no delete/update method
/// anywhere in this service (Hard Rule #5, NFR-SEC-05: audit is append-only, "admin không
/// xóa log tùy tiện").
@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogQueryDto): Promise<PaginatedResult<AuditLog>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.objectType ? { objectType: query.objectType } : {}),
      ...(query.objectId ? { objectId: query.objectId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.caseId ? { caseId: query.caseId } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } }
        : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.auditLog.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }
}
