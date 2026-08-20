import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTestRecordDto } from './create-test-record.dto';

/// `testType`/`attemptNumber` identify the attempt (`@@unique([caseId, testType,
/// attemptNumber])`) — never re-targetable via edit; correcting those means creating a
/// new attempt record instead.
export class UpdateTestRecordDto extends PartialType(OmitType(CreateTestRecordDto, ['testType', 'attemptNumber'] as const)) {}
