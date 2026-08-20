import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

export class StudentQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2)
  targetCountry?: string;
}
