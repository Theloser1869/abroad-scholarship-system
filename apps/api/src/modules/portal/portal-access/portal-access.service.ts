import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentContact } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { hashPassword } from '../../../common/security/password.util';
import { generateOpaqueToken, hashOpaqueToken } from '../../../common/security/token.util';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { AcceptParentInvitationDto } from './dto/accept-parent-invitation.dto';
import { CreateStudentContactDto } from './dto/create-student-contact.dto';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md Parent access model. Reuses the EXISTING
/// `StudentContact`/`portalUserId` link (Phase 03, schema-only until now — same
/// "schema waited, this phase builds it" pattern as Partner/PartnerDocument in Phase 10),
/// extended with `portalStatus`/`ParentInvitation` for the invite/verify/revoke lifecycle
/// this phase adds (`docs/DECISIONS.md` DEC-06, `docs/ASSUMPTIONS.md` ASM-46). No new
/// "PortalUser"/"ParentAccount" entity — `User` + `StudentContact` are the entire model.
@Injectable()
export class PortalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly config: ConfigService,
  ) {}

  async listContactsForStudent(principal: Principal, studentId: string): Promise<StudentContact[]> {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.prisma.studentContact.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' } });
  }

  /// Staff-only (gated by `students:edit` at the controller) — creates the contact-person
  /// record itself; portal access is a SEPARATE, later step (`invite`). A contact with no
  /// portal login at all (e.g. a staff-entered emergency contact) is a completely normal,
  /// expected end state — `portalStatus` simply stays NONE forever.
  async createContact(principal: Principal, studentId: string, dto: CreateStudentContactDto): Promise<StudentContact> {
    await this.scope.assertStudentAccessible(principal, studentId);
    return this.prisma.studentContact.create({
      data: { studentId, type: dto.type, name: dto.name, relationship: dto.relationship, phone: dto.phone, email: dto.email },
    });
  }

  /// NONE|REVOKED -> INVITED. Requires the contact to already have an `email` on file
  /// (nowhere else to send the invite). A fresh `ParentInvitation` row is always created
  /// (never overwrites a prior one, preserving invite history) — see
  /// `docs/ASSUMPTIONS.md` ASM-46.
  async inviteParent(principal: Principal, studentId: string, contactId: string): Promise<{ devToken?: string }> {
    await this.scope.assertStudentAccessible(principal, studentId);
    const contact = await this.findContactOrThrow(studentId, contactId);
    if (contact.portalStatus === 'ACTIVE') {
      throw new ConflictException({ code: 'PARENT_ALREADY_ACTIVE', message: 'This contact already has active portal access.' });
    }
    if (!contact.email) {
      throw new ConflictException({ code: 'CONTACT_EMAIL_REQUIRED', message: 'This contact has no email on file to invite.' });
    }

    const rawToken = generateOpaqueToken();
    const ttlHours = Number(this.config.get<string>('PORTAL_INVITE_TTL_HOURS') ?? '72');
    await this.prisma.$transaction([
      this.prisma.parentInvitation.create({
        data: {
          studentContactId: contact.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
          invitedById: principal.userId,
        },
      }),
      this.prisma.studentContact.update({ where: { id: contact.id }, data: { portalStatus: 'INVITED' } }),
    ]);

    // Same "no email-delivery integration until Phase 12" gap already documented for
    // password reset (docs/ASSUMPTIONS.md) — the raw token is only ever returned outside
    // production, standing in for the email that would otherwise carry it. Never logged.
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return isProduction ? {} : { devToken: rawToken };
  }

  /// Token possession = verification, the same standard already applied to password reset
  /// (`docs/ASSUMPTIONS.md` ASM-46). If a User with this contact's email already exists
  /// (a parent linking a SECOND child), that account is reused — never a duplicate User;
  /// otherwise `username`/`password` (required in that branch only) provision a new one.
  async acceptInvitation(rawToken: string, dto: AcceptParentInvitationDto): Promise<{ studentContactId: string }> {
    const tokenHash = hashOpaqueToken(rawToken);
    const invitation = await this.prisma.parentInvitation.findUnique({ where: { tokenHash }, include: { studentContact: true } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
      throw new ConflictException({ code: 'INVALID_OR_USED_INVITATION', message: 'This invitation link is invalid or has already been used.' });
    }

    const contact = invitation.studentContact;
    let userId: string;
    const existingUser = contact.email ? await this.prisma.user.findUnique({ where: { email: contact.email } }) : null;
    if (existingUser) {
      if (existingUser.roleId !== (await this.requireRoleId('STUDENT_PARENT'))) {
        throw new ConflictException({ code: 'EMAIL_BELONGS_TO_STAFF_ACCOUNT', message: 'This email belongs to an internal staff account, not a parent account.' });
      }
      userId = existingUser.id;
    } else {
      if (!dto.username || !dto.password) {
        throw new ConflictException({ code: 'CREDENTIALS_REQUIRED', message: 'A username and password are required to create your portal account.' });
      }
      const created = await this.prisma.user.create({
        data: {
          username: dto.username,
          email: contact.email!,
          fullName: contact.name,
          passwordHash: hashPassword(dto.password),
          roleId: await this.requireRoleId('STUDENT_PARENT'),
        },
      });
      userId = created.id;
    }

    await this.prisma.$transaction([
      this.prisma.parentInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
      this.prisma.studentContact.update({
        where: { id: contact.id },
        data: { portalUserId: userId, portalStatus: 'ACTIVE', revokedAt: null, revokedById: null },
      }),
    ]);
    return { studentContactId: contact.id };
  }

  /// ACTIVE -> REVOKED. "Quyền truy cập phải mất ngay theo policy" — every
  /// `ScopePolicyService` OWN_STUDENT check re-reads `portalStatus` fresh on every request
  /// (no caching), so this closes off access to every Case/Contract/Payment/etc. route
  /// immediately. The one exception the scope check alone can't close is grant-BASED
  /// Document access (`DocumentAccess` rows persist independently of `portalStatus`) — so
  /// this also expires every one of the revoked user's existing grants, the same
  /// `expiresAt`-sweep mechanism `DocumentsService.assertAccessible` already checks, rather
  /// than deleting the rows (keeps them as history). See `docs/ASSUMPTIONS.md` ASM-46.
  async revokeParentAccess(principal: Principal, studentId: string, contactId: string): Promise<StudentContact> {
    await this.scope.assertStudentAccessible(principal, studentId);
    const contact = await this.findContactOrThrow(studentId, contactId);
    if (contact.portalStatus !== 'ACTIVE') {
      throw new ConflictException({ code: 'PARENT_NOT_ACTIVE', message: 'This contact does not currently have active portal access.' });
    }
    const now = new Date();
    const [, updated] = await this.prisma.$transaction([
      this.prisma.documentAccess.updateMany({
        where: { principalId: contact.portalUserId!, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        data: { expiresAt: now },
      }),
      this.prisma.studentContact.update({
        where: { id: contact.id },
        data: { portalStatus: 'REVOKED', revokedAt: now, revokedById: principal.userId },
      }),
    ]);
    return updated;
  }

  /// `GET /portal/me` — resolves the caller's own accessible Student(s) without trusting
  /// any client-supplied id: a STUDENT_PARENT principal is either a Student themselves
  /// (`portalUserId`) or an ACTIVE-linked parent of one or more Students via
  /// `StudentContact` — never both being possible to conflate, and never inferred from
  /// anything the client sent.
  async myAccessibleStudents(principal: Principal) {
    const [self, linked] = await Promise.all([
      this.prisma.student.findUnique({ where: { portalUserId: principal.userId }, select: { id: true, studentCode: true, fullName: true } }),
      this.prisma.studentContact.findMany({
        where: { portalUserId: principal.userId, portalStatus: 'ACTIVE' },
        select: { relationship: true, student: { select: { id: true, studentCode: true, fullName: true } } },
      }),
    ]);
    const students = [
      ...(self ? [{ ...self, relationship: 'SELF' }] : []),
      ...linked.map((l) => ({ ...l.student, relationship: l.relationship ?? 'PARENT' })),
    ];
    return { userId: principal.userId, roleCode: principal.roleCode, students };
  }

  private async findContactOrThrow(studentId: string, contactId: string): Promise<StudentContact> {
    const contact = await this.prisma.studentContact.findUnique({ where: { id: contactId } });
    if (!contact || contact.studentId !== studentId) {
      throw new NotFoundException({ code: 'STUDENT_CONTACT_NOT_FOUND', message: `Contact ${contactId} not found for this student.` });
    }
    return contact;
  }

  private async requireRoleId(code: string): Promise<string> {
    const role = await this.prisma.role.findUnique({ where: { code: code as never } });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: `Role ${code} not found.` });
    return role.id;
  }
}
