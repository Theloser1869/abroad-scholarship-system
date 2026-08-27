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

  /// Client Acceptance Remediation DEC-07 (GAP-007) — the unified closure checklist's
  /// tri-state "Visa" item. The only one of the 6 checklist items the client's own decision
  /// allows a NOT_APPLICABLE state for ("một hồ sơ không yêu cầu Visa riêng: Visa =
  /// NOT_APPLICABLE") — reuses the exact same "open" definition as `hasOpenVisa` above
  /// (kept unchanged, still used by the old boolean call sites), just reported as three
  /// states instead of one boolean.
  async getClosureStatus(caseId: string): Promise<'PASS' | 'FAIL' | 'NOT_APPLICABLE'> {
    const total = await this.prisma.visa.count({ where: { caseId } });
    if (total === 0) return 'NOT_APPLICABLE';
    return (await this.hasOpenVisa(caseId)) ? 'FAIL' : 'PASS';
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

  /// Client Acceptance Remediation sheet06 row14 ("Checklist hoàn tất") — the batched
  /// counterpart to `hasIncompletePreDepartureChecklist` above, used by `ReportsService` for
  /// the KPI dashboard. Reuses the exact same "applicable, required, not DONE/WAIVED"
  /// condition, just counting cases instead of returning a boolean for one.
  async countPreDepartureChecklistCompletion(): Promise<{ applicable: number; complete: number }> {
    const applicableCases = await this.prisma.visaChecklistItem.findMany({
      where: { entityType: 'PreDeparture', required: true },
      select: { entityId: true },
      distinct: ['entityId'],
    });
    const incompleteCases = await this.prisma.visaChecklistItem.findMany({
      where: { entityType: 'PreDeparture', required: true, status: { notIn: ['DONE', 'WAIVED'] } },
      select: { entityId: true },
      distinct: ['entityId'],
    });
    return { applicable: applicableCases.length, complete: applicableCases.length - incompleteCases.length };
  }
}
