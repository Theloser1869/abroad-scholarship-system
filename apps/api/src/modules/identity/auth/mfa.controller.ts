import { BadRequestException, Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MfaEnrollConfirmDto } from './dto/mfa-enroll-confirm.dto';
import { MfaService } from './mfa.service';

/// MFA enrollment requires an already-authenticated session (SRS 6.1: internal accounts
/// enroll after they exist, not as part of the public signup surface — there is no public
/// signup surface at all in this system, accounts are staff-provisioned).
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('enroll')
  @Audit('EDIT')
  async enroll(@CurrentUser() principal: Principal | null) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: principal.userId } });
    const { secret, otpauthUrl } = await this.mfa.startEnrollment(principal.userId, user.email);
    return { secret, otpauthUrl };
  }

  @Post('enroll/confirm')
  @Audit('EDIT')
  async confirmEnroll(@CurrentUser() principal: Principal | null, @Body() dto: MfaEnrollConfirmDto) {
    if (!principal) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const backupCodes = await this.mfa.confirmEnrollment(principal.userId, dto.code);
    if (backupCodes.length === 0) {
      throw new BadRequestException({ code: 'INVALID_MFA_CODE', message: 'The provided code did not match.' });
    }
    return { enabled: true, backupCodes };
  }
}
