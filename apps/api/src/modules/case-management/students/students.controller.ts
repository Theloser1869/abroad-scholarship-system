import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { Principal } from '../../../common/context/principal';
import { CreateNoteDto } from '../../../common/dto/create-note.dto';
import { PaginatedResult } from '../../../common/dto/list-query.dto';
import { Idempotent } from '../../../common/idempotency/idempotency.interceptor';
import { FieldPolicyService, RedactedStudent } from '../../identity/rbac/field-policy.service';
import { CasesService } from '../cases/cases.service';
import { CreateCaseDto } from '../cases/dto/create-case.dto';
import { CommentsService } from '../../notifications/comments/comments.service';
import { TimelineService } from '../../reporting/timeline/timeline.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ExportStudentsQueryDto } from './dto/export-students-query.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

/// Reference implementation of both the Phase 02B API convention
/// (docs/api/API_CONVENTIONS.md) and Phase 03B RBAC scope/field-level enforcement
/// (docs/security/RBAC_MATRIX.md). Every handler: (1) requires an authenticated
/// principal — defensive check even though AuthGuard already guarantees it for a
/// non-@Public route, (2) delegates record-scope to StudentsService/ScopePolicyService,
/// (3) redacts field-level-sensitive columns via FieldPolicyService before the response
/// leaves the process (never on the frontend).
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly fieldPolicy: FieldPolicyService,
    private readonly cases: CasesService,
    private readonly comments: CommentsService,
    private readonly timeline: TimelineService,
  ) {}

  @Get('export')
  @RequirePermission('students', 'export')
  @Audit('EXPORT')
  async export(@CurrentUser() principal: Principal | null, @Query() query: ExportStudentsQueryDto, @Req() req: Request) {
    const actor = requirePrincipal(principal);
    const { rows, rowCount } = await this.students.export(actor);
    const redacted = rows.map((row) => this.fieldPolicy.redactStudent(row, actor.roleCode));
    const fields = redacted.length > 0 ? Object.keys(redacted[0]) : [];
    // SRS 6.21: reason, filter scope, row count, fields exported — recorded for the audit
    // write the AuditInterceptor performs after this handler returns.
    req.auditMetadata = { reason: query.reason, filterScope: 'scope-filtered list (see ScopePolicyService)', rowCount, fields };
    return { rows: redacted, rowCount };
  }

  @Get()
  @RequirePermission('students', 'view')
  async list(@CurrentUser() principal: Principal | null, @Query() query: StudentQueryDto): Promise<PaginatedResult<RedactedStudent>> {
    const actor = requirePrincipal(principal);
    const result = await this.students.list(actor, query);
    return new PaginatedResult(
      result.data.map((row) => this.fieldPolicy.redactStudent(row, actor.roleCode)),
      result.meta,
    );
  }

  @Get(':id')
  @RequirePermission('students', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string): Promise<RedactedStudent> {
    const actor = requirePrincipal(principal);
    const student = await this.students.getById(actor, id);
    return this.fieldPolicy.redactStudent(student, actor.roleCode);
  }

  @Post()
  @RequirePermission('students', 'create')
  @Audit('CREATE')
  @Idempotent()
  async create(@Body() dto: CreateStudentDto, @CurrentUser() principal: Principal | null) {
    const actor = requirePrincipal(principal);
    const student = await this.students.create(dto);
    return this.fieldPolicy.redactStudent(student, actor.roleCode);
  }

  @Patch(':id')
  @RequirePermission('students', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    const actor = requirePrincipal(principal);
    const student = await this.students.update(actor, id, dto);
    return this.fieldPolicy.redactStudent(student, actor.roleCode);
  }

  @Patch(':id/archive')
  @RequirePermission('students', 'archive')
  @Audit('ARCHIVE')
  async archive(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    const student = await this.students.archive(actor, id);
    return this.fieldPolicy.redactStudent(student, actor.roleCode);
  }

  /// "Lead → Student → Case" chain, second entry point (04-core-crm/02_STUDENT_CASE.md):
  /// opening a new Case lifecycle for a Student who already exists (e.g. re-engagement
  /// after a prior case closed). `CasesService.createForStudent` enforces the "no second
  /// concurrent active Case" invariant.
  @Post(':id/cases')
  @RequirePermission('cases', 'assign')
  @Audit('CREATE')
  @Idempotent()
  async createCase(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCaseDto,
    @Req() req: Request,
  ) {
    const actor = requirePrincipal(principal);
    await this.students.getById(actor, id); // scope check before writing
    const created = await this.cases.createForStudent(actor, id, dto);
    // The audit row for this route is keyed on the Student (objectType='Students',
    // objectId=studentId, from req.params.id) — the new Case's own id is recorded here
    // rather than mis-tagging the row as a Case object under a Students-domain route.
    req.auditMetadata = { newCaseId: created.id, newCaseCode: created.caseCode };
    return created;
  }

  @Post(':id/notes')
  @RequirePermission('students', 'edit')
  @Audit('EDIT')
  async addNote(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto) {
    const actor = requirePrincipal(principal);
    await this.students.getById(actor, id); // scope check before writing
    return this.comments.create('Student', id, actor.userId, dto.body, dto.visibility ?? 'internal');
  }

  @Get(':id/timeline')
  @RequirePermission('students', 'view')
  async getTimeline(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const actor = requirePrincipal(principal);
    await this.students.getById(actor, id); // scope check before reading
    const visibleVisibilities = actor.roleCode === 'STUDENT_PARENT' ? (['shared'] as const) : (['internal', 'shared'] as const);
    return this.timeline.forEntity('Students', 'Student', id, [...visibleVisibilities]);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
