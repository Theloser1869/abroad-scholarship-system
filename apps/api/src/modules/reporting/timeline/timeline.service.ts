import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface TimelineEntry {
  type: 'AUDIT' | 'NOTE';
  action?: string;
  result?: string;
  body?: string;
  visibility?: string;
  actorId: string | null;
  createdAt: Date;
}

/// 04-core-crm/01_LEAD.md "timeline" / 02_STUDENT_CASE.md "case timeline"/"Student 360:
/// ...timeline". Not a new stored entity — a read-only merge of two tables that already
/// exist and already carry exactly this information: `AuditLog` (every VIEW/CREATE/EDIT/
/// ARCHIVE/EXPORT/... event — see docs/security/AUTH_MODEL.md / RBAC_MATRIX.md) and
/// `Comment` (the "notes" Phase 04 adds — comments.service.ts). Inventing a dedicated
/// `Timeline`/`Activity` table would duplicate what AuditLog already is (Hard Rule: no
/// duplicate entity/concept) — this is domain 11 (Reporting)'s read-only-aggregation role
/// exactly as designed in docs/architecture/DOMAIN_MAP.md.
///
/// `objectType` must match the exact value `AuditInterceptor` writes (the controller class
/// name with "Controller" stripped, e.g. "Leads", "Students", "Cases").
@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async forEntity(objectType: string, entityType: string, id: string, visibleVisibilities: CommentVisibilityFilter): Promise<TimelineEntry[]> {
    const [auditRows, commentRows] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { objectType, objectId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.comment.findMany({
        where: { entityType, entityId: id, visibility: { in: visibleVisibilities } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const entries: TimelineEntry[] = [
      ...auditRows.map(
        (row): TimelineEntry => ({
          type: 'AUDIT',
          action: row.action,
          result: row.result,
          actorId: row.actorId,
          createdAt: row.createdAt,
        }),
      ),
      ...commentRows.map(
        (row): TimelineEntry => ({
          type: 'NOTE',
          body: row.body,
          visibility: row.visibility,
          actorId: row.authorId,
          createdAt: row.createdAt,
        }),
      ),
    ];

    return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export type CommentVisibilityFilter = ('internal' | 'shared')[];
