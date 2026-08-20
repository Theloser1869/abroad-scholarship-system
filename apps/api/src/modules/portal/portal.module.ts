import { Module } from '@nestjs/common';
import { PortalAccessModule } from './portal-access/portal-access.module';
import { PortalReadModule } from './portal/portal.module';

/// 11-portal/01_STUDENT_PARENT_PORTAL.md — the Portal is "một lớp truy cập an toàn vào dữ
/// liệu hiện có," never a parallel domain: `PortalAccessModule` owns exactly the two
/// genuinely new pieces this phase adds (StudentContact's first real controller/service,
/// and the ParentInvitation lifecycle); `PortalReadModule` owns zero new business entities
/// at all, only thin delegation into every domain module Phase 05-10 already built.
@Module({
  imports: [PortalAccessModule, PortalReadModule],
})
export class PortalModule {}
