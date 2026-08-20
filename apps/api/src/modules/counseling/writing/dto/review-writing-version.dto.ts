import { IsIn } from 'class-validator';

const REVIEW_STATUSES = ['APPROVED', 'CHANGES_REQUESTED'] as const;

/// The verdict itself — the reviewer's actual feedback text goes through the existing
/// `Comment` entity (`POST /writing-versions/:id/comments`), not a field here; 03_WRITING.md
/// "Feedback phải gắn với đúng writing artifact/version... không tạo ReviewComment entity
/// duplicate."
export class ReviewWritingVersionDto {
  @IsIn(REVIEW_STATUSES)
  reviewStatus!: (typeof REVIEW_STATUSES)[number];
}
