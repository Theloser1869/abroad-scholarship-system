import { IsUUID } from 'class-validator';

export class AddMilestoneDependencyDto {
  @IsUUID()
  dependsOnMilestoneId!: string;
}
