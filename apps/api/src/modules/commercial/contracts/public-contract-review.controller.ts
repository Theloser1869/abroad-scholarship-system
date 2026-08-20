import { Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { hashOpaqueToken } from '../../../common/security/token.util';

/// SRS 6.16 "Gửi client review bằng secure link có expiry" — the ONE deliberately
/// unauthenticated surface in this whole API. The client reviewing a contract may not
/// even have a portal login yet (Lead→Student conversion doesn't create one — see
/// docs/ASSUMPTIONS.md ASM-05), so this cannot require a session. The token itself IS the
/// authorization: a long, random, single-contract-scoped, expiring, hash-stored secret —
/// not a "public URL for a private file" in the sense Hard Rule #6 forbids (that rule is
/// about *permanent*, guessable, un-scoped URLs; this is the same class of control as a
/// password-reset link). No `@RequirePermission` here at all — there's no principal to
/// check a permission against.
@Controller('public/contracts')
export class PublicContractReviewController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('review/:token')
  @Audit('VIEW')
  async review(@Param('token') token: string, @Req() req: Request) {
    const link = await this.prisma.contractReviewLink.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { contract: { include: { student: { select: { fullName: true } } } } },
    });
    if (!link || link.revokedAt || link.expiresAt < new Date()) {
      // Same 404 regardless of "no such token" vs "expired" vs "revoked" — no reason to
      // help an attacker distinguish which.
      throw new NotFoundException({ code: 'REVIEW_LINK_INVALID', message: 'This review link is invalid or has expired.' });
    }

    if (!link.viewedAt) {
      await this.prisma.contractReviewLink.update({ where: { id: link.id }, data: { viewedAt: new Date() } });
    }

    const { contract } = link;
    // `:token` isn't `:id`, so AuditInterceptor's default objectId extraction won't find
    // one from the route params — record which contract was viewed explicitly.
    req.auditMetadata = { contractId: contract.id, contractCode: contract.contractCode };
    // Deliberately minimal — only what a client needs to decide whether to sign. No
    // internal ids (approvedById, templateId), no other students' data (the token is
    // scoped to exactly one contract already).
    return {
      contractCode: contract.contractCode,
      studentName: contract.student.fullName,
      servicePackage: contract.servicePackage,
      value: contract.value,
      currency: contract.currency,
      mergeFieldValues: contract.mergeFieldValues,
      status: contract.status,
    };
  }
}
