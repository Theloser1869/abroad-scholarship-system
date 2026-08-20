import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

/// Generic field edit — never `status` (that FSM has its own dedicated endpoint/DTO,
/// `update-task-status.dto.ts`) and never `ownerId` (reassignment is its own dedicated
/// endpoint/DTO, `assign-task.dto.ts`) — same "own method per state-changing action, no
/// bare field PATCH" pattern already used for Lead/Case/Contract.
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['ownerId'] as const)) {}
