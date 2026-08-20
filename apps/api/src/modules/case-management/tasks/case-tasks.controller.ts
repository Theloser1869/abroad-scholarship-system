import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Principal } from '../../../common/context/principal';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TasksService } from './tasks.service';

/// Tasks are a sub-resource of the Case they belong to (06-operations/01_TASK.md "Task
/// phải thuộc đúng Student/Case scope") — nested under `/cases/:caseId/tasks`, distinct
/// from the flat `/tasks/:id` actions in `TasksController`. Same nesting pattern as
/// `ContractPaymentsController` in Phase 05.
@Controller('cases/:caseId/tasks')
export class CaseTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('tasks', 'view')
  async list(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Query() query: TaskQueryDto) {
    return this.tasks.listForCase(requirePrincipal(principal), caseId, query);
  }

  @Post()
  @RequirePermission('tasks', 'create')
  @Audit('CREATE')
  async create(@CurrentUser() principal: Principal | null, @Param('caseId', ParseUUIDPipe) caseId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.createForCase(requirePrincipal(principal), caseId, dto);
  }
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
