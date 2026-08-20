import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class ProgramQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  universityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  degreeLevel?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
