import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'ZALO', 'WHATSAPP'] as const;

export class NotificationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unreadOnly?: boolean;
}
