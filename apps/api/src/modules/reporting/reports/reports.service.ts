import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { PaymentsService } from '../../commercial/payments/payments.service';
import { TasksService } from '../../case-management/tasks/tasks.service';

/// Mirrors `TasksService`'s own private `TERMINAL_STATUSES` constant (not exported) — a
/// query-filter value, not a re-derivation of task-completion business logic.
const TASK_TERMINAL_STATUSES = ['DONE', 'CANCELLED'] as const;
const CASE_OPEN_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD'] as const;

/// 12-platform/03_REPORTING.md. Every number here is computed live from the existing
/// source-of-truth tables (Case/Task/Payment/Application/ScholarshipApplication/Visa/
/// Enrollment) at query time — no shadow/materialized table, no separate calculation from
/// what the underlying entity's own service would compute (Payment's outstanding amount
/// reuses `PaymentsService.outstandingAmount` directly; Task's overdue determination
/// reuses `TasksService.isOverdue`), per "Không tạo calculation khác nhau giữa dashboard,
/// API, và export."
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly payments: PaymentsService,
    private readonly tasks: TasksService,
  ) {}

  /// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only — the same narrow role-check pattern
  /// already used for `TasksController.runReminders`/`PaymentsController.runReminders`,
  /// on top of the base `reports:view` grant every staff role holds (so `/reports/me`,
  /// below, stays reachable for everyone while this one stays leadership-only).
  async executiveDashboard(principal: Principal) {
    this.assertRole(principal, ['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER']);

    const [activeCases, pipeline, payments, applications, scholarships, visas, enrollments, closure, tasks] = await Promise.all([
      this.prisma.case.count({ where: { status: { in: [...CASE_OPEN_STATUSES] } } }),
      this.prisma.case.groupBy({ by: ['status'], _count: true }),
      this.prisma.payment.findMany({ select: { amount: true, paidAmount: true, refundedAmount: true, currency: true, status: true, dueDate: true } }),
      this.prisma.application.groupBy({ by: ['status'], _count: true }),
      this.prisma.scholarshipApplication.groupBy({ by: ['status'], _count: true }),
      this.prisma.visa.groupBy({ by: ['status'], _count: true }),
      this.prisma.enrollment.groupBy({ by: ['status'], _count: true }),
      this.prisma.case.count({ where: { status: { in: ['CLOSED', 'ARCHIVED'] } } }),
      this.prisma.task.findMany({ where: { status: { notIn: [...TASK_TERMINAL_STATUSES] } }, select: { status: true, deadline: true } }),
    ]);

    // Phase 14 fix (Final Architect Review finding) — Payment/Contract carry a per-record
    // `currency` (SRS §6.16, deliberately no single agency currency — different
    // destination-country contracts genuinely use different currencies). Summing raw
    // numeric amounts across currencies as if equivalent produced a meaningless number the
    // moment more than one currency existed (e.g. "2000" from 1000 USD + 1000 GBP). Grouped
    // by currency instead — the only representation that is ever numerically correct.
    const revenue = this.sumByCurrency(payments, (p) => p.paidAmount);
    const receivables = this.sumByCurrency(payments, (p) => this.payments.outstandingAmount(p));
    const overduePaymentsCount = payments.filter((p) => this.payments.isOverdue(p)).length;

    // SRS §6.21 "Dashboard GĐĐH: ... workload, deadlines, ..." — org-wide totals here
    // (single glance, no per-person drilldown); `managerDashboard` below already gives
    // ED/DM the per-owner breakdown when they need it. Reuses `TasksService.isOverdue`,
    // never a second overdue calculation.
    const overdueTasks = tasks.filter((t) => this.tasks.isOverdue(t));
    const dueSoonCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dueWithin7DaysTasks = tasks.filter((t) => !this.tasks.isOverdue(t) && t.deadline <= dueSoonCutoff);

    return {
      activeCases,
      pipeline: pipeline.map((p) => ({ status: p.status, count: p._count })),
      revenue,
      receivables,
      overduePaymentsCount,
      workload: { openTasks: tasks.length, overdueTasks: overdueTasks.length },
      deadlines: { overdueTasks: overdueTasks.length, dueWithin7Days: dueWithin7DaysTasks.length },
      applications: applications.map((a) => ({ status: a.status, count: a._count })),
      scholarships: scholarships.map((s) => ({ status: s.status, count: s._count })),
      visas: visas.map((v) => ({ status: v.status, count: v._count })),
      enrollments: enrollments.map((e) => ({ status: e.status, count: e._count })),
      closedOrArchivedCases: closure,
    };
  }

  /// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only. "SLA" and "quality" are not defined
  /// anywhere in this project's SRS or any Phase 01-11 instruction file — computed here as
  /// two clearly-labeled, honestly-named derived metrics (on-time completion rate; average
  /// `Task.qualityScore`) rather than an invented, unlabeled "SLA score." See
  /// `docs/ASSUMPTIONS.md` ASM-55.
  async managerDashboard(principal: Principal) {
    this.assertRole(principal, ['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER']);

    const tasks = await this.prisma.task.findMany({
      select: { ownerId: true, status: true, deadline: true, updatedAt: true, qualityScore: true },
    });
    const byOwner = new Map<string, { open: number; overdue: number; done: number; onTimeDone: number; qualitySum: number; qualityCount: number }>();
    for (const t of tasks) {
      const bucket = byOwner.get(t.ownerId) ?? { open: 0, overdue: 0, done: 0, onTimeDone: 0, qualitySum: 0, qualityCount: 0 };
      if (!TASK_TERMINAL_STATUSES.includes(t.status as never)) {
        bucket.open += 1;
        if (this.tasks.isOverdue(t)) bucket.overdue += 1;
      }
      if (t.status === 'DONE') {
        // No dedicated `completedAt` column exists on Task — `updatedAt` is used as a
        // reasonable proxy for "when it was marked done" (the last write to the row is
        // almost always the DONE transition itself); an honest approximation, not a
        // precise completion timestamp. See docs/ASSUMPTIONS.md ASM-55.
        bucket.done += 1;
        if (t.updatedAt <= t.deadline) bucket.onTimeDone += 1;
      }
      if (t.qualityScore !== null) {
        bucket.qualitySum += t.qualityScore;
        bucket.qualityCount += 1;
      }
      byOwner.set(t.ownerId, bucket);
    }

    const workload = [...byOwner.entries()].map(([ownerId, b]) => ({
      ownerId,
      openTasks: b.open,
      overdueTasks: b.overdue,
      onTimeCompletionRate: b.done > 0 ? Number((b.onTimeDone / b.done).toFixed(2)) : null,
      averageQualityScore: b.qualityCount > 0 ? Number((b.qualitySum / b.qualityCount).toFixed(1)) : null,
    }));

    const upcomingApplicationDeadlines = await this.prisma.application.count({
      where: { status: { notIn: ['OFFER', 'REJECT', 'WITHDRAWN'] } },
    });

    return { workload, upcomingApplicationDeadlines };
  }

  /// Every staff role's own self-scoped summary — "my cases/tasks/deadlines." Reuses the
  /// same `ScopePolicyService` filters every other list endpoint already applies, so this
  /// never sees a record the caller couldn't otherwise reach directly.
  async myDashboard(principal: Principal) {
    const [myOpenCases, myTasks] = await Promise.all([
      this.prisma.case.count({ where: { status: { in: [...CASE_OPEN_STATUSES] }, ...this.scope.caseListFilter(principal) } }),
      this.prisma.task.findMany({ where: { ownerId: principal.userId, status: { notIn: [...TASK_TERMINAL_STATUSES] } }, select: { status: true, deadline: true } }),
    ]);
    const overdueTasks = myTasks.filter((t) => this.tasks.isOverdue(t)).length;

    return { myOpenCases, myOpenTasks: myTasks.length, myOverdueTasks: overdueTasks };
  }

  /// EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only (same as `students.export`'s existing
  /// precedent). Scope-filtered via the SAME `ScopePolicyService.caseListFilter` every
  /// other Case list endpoint uses — an export can never surface a row the caller couldn't
  /// otherwise read record-by-record.
  async exportCases(principal: Principal): Promise<{ rows: unknown[]; rowCount: number }> {
    this.assertRole(principal, ['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER']);
    const rows = await this.prisma.case.findMany({ where: this.scope.caseListFilter(principal), orderBy: { createdAt: 'desc' } });
    return { rows, rowCount: rows.length };
  }

  private sumByCurrency<T extends { currency: string }>(rows: T[], amountOf: (row: T) => Prisma.Decimal.Value): { currency: string; amount: string }[] {
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      totals.set(row.currency, (totals.get(row.currency) ?? new Prisma.Decimal(0)).plus(amountOf(row)));
    }
    return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: amount.toFixed(2) }));
  }

  private assertRole(principal: Principal, allowed: string[]): void {
    if (!allowed.includes(principal.roleCode)) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: `Only ${allowed.join(' or ')} may access this report.` });
    }
  }
}
