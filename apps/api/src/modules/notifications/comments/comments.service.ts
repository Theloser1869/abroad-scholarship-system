import { Injectable } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type CommentVisibility = 'internal' | 'shared';

/// First slice of docs/architecture/DOMAIN_MAP.md domain 10 (Notifications) — owns
/// `Comment`. Phase 04 needs entity-attached "notes" (04-core-crm/01_LEAD.md "notes";
/// 04-core-crm/02_STUDENT_CASE.md "timeline") now; rather than inventing a duplicate
/// `Note` concept, this reuses the `Comment` table Phase 02 already built for exactly
/// this polymorphic entity-attached purpose (Hard Rule: no duplicate entity/concept). Full
/// generic Comment CRUD (threading, mentions, edit/delete) remains Phase 06 scope — this
/// is deliberately just "create" + "list for an entity", the minimum Phase 04's "notes"
/// requirement needs. See docs/ASSUMPTIONS.md ASM-10.
@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(entityType: string, entityId: string, authorId: string, body: string, visibility: CommentVisibility): Promise<Comment> {
    return this.prisma.comment.create({
      data: { entityType, entityId, authorId, body, visibility },
    });
  }

  async listForEntity(entityType: string, entityId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
