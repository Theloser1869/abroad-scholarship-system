import { Module } from '@nestjs/common';
import { AssessmentsModule } from './assessments/assessments.module';
import { ProfileEvidenceModule } from './profile-evidence/profile-evidence.module';
import { RoadmapsModule } from './roadmaps/roadmaps.module';
import { WritingModule } from './writing/writing.module';

/// Domain module boundary per docs/architecture/DOMAIN_MAP.md domain 4 (Counseling,
/// includes "Profile Development"): owns Assessment, AssessmentCriterion, Roadmap,
/// RoadmapMilestone, RoadmapMilestoneDependency, AcademicRecord, TestRecord, Competition,
/// ResearchProject, Activity, WritingArtifact, WritingVersion, LetterOfRecommendation
/// (07-profile/*.md, Phase 07).
@Module({
  imports: [AssessmentsModule, RoadmapsModule, ProfileEvidenceModule, WritingModule],
})
export class CounselingModule {}
