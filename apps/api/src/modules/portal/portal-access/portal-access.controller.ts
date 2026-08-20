import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Principal } from '../../../common/context/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { AcceptParentInvitationDto } from './dto/accept-parent-invitation.dto';
import { CreateStudentContactDto } from './dto/create-student-contact.dto';
import { PortalAccessService } from './portal-access.service';

/// Staff-facing StudentContact + parent-invite/revoke management. Gated by `students:edit`
/// (a StudentContact is a sub-resource of Student, same permission home as
/// `students:archive` — no new permission resource invented for this).
@Controller('students/:studentId/contacts')
export class StudentContactsController {
  constructor(private readonly service: PortalAccessService) {}

  @Get()
  @RequirePermission('students', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listContactsForStudent(requirePrincipal(principal), studentId);
  }

  @Post()
  @RequirePermission('students', 'edit')
  @Audit('CREATE')
  async create(
    @CurrentUser() principal: Principal | null,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentContactDto,
  ) {
    return this.service.createContact(requirePrincipal(principal), studentId, dto);
  }

  @Post(':contactId/invite')
  @RequirePermission('students', 'edit')
  @Audit('INVITE')
  async invite(
    @CurrentUser() principal: Principal | null,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Req() req: Request,
  ) {
    // The response body (`{devToken}`) carries no natural `id` for
    // `AuditInterceptor.extractObjectId`'s payload-fallback to find (and the route uses
    // `:studentId`/`:contactId`, never a literal `:id`, so its param-based extraction
    // doesn't fire either) — set it explicitly.
    req.auditMetadata = { studentId, contactId };
    return this.service.inviteParent(requirePrincipal(principal), studentId, contactId);
  }

  @Post(':contactId/revoke')
  @RequirePermission('students', 'edit')
  @Audit('REVOKE')
  async revoke(
    @CurrentUser() principal: Principal | null,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.revokeParentAccess(requirePrincipal(principal), studentId, contactId);
  }
}

/// The one deliberately unauthenticated surface in this module — same reasoning as
/// `PublicContractReviewController` (Phase 05): the invited parent has no session yet by
/// definition. The token itself IS the authorization.
@Controller('public/portal/parent-invitations')
export class PublicParentInvitationsController {
  constructor(private readonly service: PortalAccessService) {}

  @Public()
  @Post(':token/accept')
  @Audit('VERIFY')
  async accept(@Param('token') token: string, @Body() dto: AcceptParentInvitationDto, @Req() req: Request) {
    const result = await this.service.acceptInvitation(token, dto);
    req.auditMetadata = { studentContactId: result.studentContactId };
    return result;
  }
}
