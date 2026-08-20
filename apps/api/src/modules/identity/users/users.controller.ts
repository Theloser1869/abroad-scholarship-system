import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

/// Admin-only. Deliberately scope-free (no ScopePolicyService involvement) — Users is not
/// a Student/Case-scoped resource, it's the operator/staff identity list, gated purely by
/// role→permission (SYSTEM_ADMIN via `users:*`).
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  async list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermission('users', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Patch(':id/suspend')
  @RequirePermission('users', 'suspend')
  @Audit('EDIT')
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.suspend(id);
  }

  @Patch(':id/reactivate')
  @RequirePermission('users', 'suspend')
  @Audit('EDIT')
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.reactivate(id);
  }

  @Patch(':id/offboard')
  @RequirePermission('users', 'offboard')
  @Audit('EDIT')
  async offboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.offboard(id);
  }
}
