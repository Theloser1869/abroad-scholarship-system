import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateContractDto } from './create-contract.dto';

/// Only reachable while `status === DRAFT` (`ContractsService.update`) — `studentId` is
/// excluded, matching the "never re-target a Contract to a different Student" invariant;
/// changing the student a contract is for is a new-Contract decision, not an edit.
export class UpdateContractDto extends PartialType(OmitType(CreateContractDto, ['studentId'] as const)) {}
