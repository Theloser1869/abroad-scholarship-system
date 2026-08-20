import { IsUUID } from 'class-validator';

export class AddTaskDependencyDto {
  @IsUUID()
  dependsOnTaskId!: string;
}
