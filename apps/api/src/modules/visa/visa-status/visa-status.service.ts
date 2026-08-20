import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/// `docs/architecture/DOMAIN_MAP.md` domain 6's own stated expose-point
/// ("VisaStatusService dùng bởi case-management để cho phép Case chuyển sang Closed").
/// Pure read-only checks, no other module dependency (not even Identity — these are
/// internal service-to-service calls from `CasesService.close()`, already scope-checked
/// by the time it gets here) — deliberately a leaf module so importing it from
/// `case-management` can never create a module cycle.
@Injectable()
export class VisaStatusService {
  constructor(private readonly prisma: PrismaService) {}

  /// A Visa still "in flight" (not yet GRANTED/REFUSED/WITHDRAWN) blocks Closure — the same
  /// "unresolved workflow item blocks closure" reasoning already applied to open Tasks.
  async hasOpenVisa(caseId: string): Promise<boolean> {
    const count = await this.prisma.visa.count({ where: { caseId, status: { notIn: ['GRANTED', 'REFUSED', 'WITHDRAWN'] } } });
    return count > 0;
  }

  /// Only applicable once admission was actually attempted — a Case closed early (e.g.
  /// withdrawal before any Application existed) should never be blocked waiting for an
  /// Enrollment that was never applicable. See docs/ASSUMPTIONS.md for this conditional
  /// scoping.
  async hasUnconfirmedRequiredEnrollment(caseId: string): Promise<boolean> {
    const applicationCount = await this.prisma.application.count({ where: { caseId } });
    if (applicationCount === 0) return false;
    const confirmedCount = await this.prisma.enrollment.count({ where: { caseId, status: 'CONFIRMED' } });
    return confirmedCount === 0;
  }

  /// Only applicable once at least one pre-departure checklist item exists for the Case —
  /// same conditional-scoping reasoning as above.
  async hasIncompletePreDepartureChecklist(caseId: string): Promise<boolean> {
    const count = await this.prisma.visaChecklistItem.count({
      where: { entityType: 'PreDeparture', entityId: caseId, required: true, status: { notIn: ['DONE', 'WAIVED'] } },
    });
    return count > 0;
  }
}
