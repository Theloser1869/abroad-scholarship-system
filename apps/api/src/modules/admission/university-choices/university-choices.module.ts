import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { StudentUniversityChoicesController, UniversityChoicesController } from './university-choices.controller';
import { UniversityChoicesService } from './university-choices.service';

@Module({
  imports: [IdentityModule],
  controllers: [StudentUniversityChoicesController, UniversityChoicesController],
  providers: [UniversityChoicesService],
  exports: [UniversityChoicesService],
})
export class UniversityChoicesModule {}
