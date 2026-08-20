import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/// Shared by every resource that exposes a `POST .../notes` sub-route (Lead, Student,
/// Case — 04-core-crm) — one DTO instead of three copies, backed by the `Comment` table
/// (common/audit's sibling read side is `TimelineService`; see
/// modules/notifications/comments/comments.service.ts).
export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  /// Defaults to 'internal' (staff-only) — SRS §13 "Internal notes": HS/PHHS = "Không".
  /// Only an explicit 'shared' choice makes a note visible to STUDENT_PARENT (checked via
  /// FieldPolicyService.canViewComment).
  @IsOptional()
  @IsIn(['internal', 'shared'])
  visibility?: 'internal' | 'shared';
}
