import { IsString, MaxLength, MinLength } from 'class-validator';

export class PortalSubmitTaskOutputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  output!: string;
}
