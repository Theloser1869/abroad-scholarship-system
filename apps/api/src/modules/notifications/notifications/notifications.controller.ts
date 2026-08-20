import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

/// A self-service inbox — every authenticated role may read/mark-read its OWN
/// notifications, same as `/auth/me`/`/auth/sessions` (no `@RequirePermission`
/// decorator: `AuthGuard` already allows any authenticated principal through when a route
/// declares none — see that guard's own doc comment). `NotificationsService` enforces
/// `recipientId === principal.userId` unconditionally, so there is no cross-user read path
/// to gate at the permission layer in the first place.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() principal: Principal | null, @Query() query: NotificationQueryDto) {
    return this.notifications.listInbox(requirePrincipal(principal), query);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(requirePrincipal(principal), id);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
