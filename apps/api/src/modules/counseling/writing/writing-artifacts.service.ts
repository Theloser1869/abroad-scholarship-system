import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WritingArtifact, WritingStatus, WritingVersion } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { CreateWritingArtifactDto } from './dto/create-writing-artifact.dto';
import { CreateWritingVersionDto } from './dto/create-writing-version.dto';
import { ReviewWritingVersionDto } from './dto/review-writing-version.dto';

/// SRS 6.6 workflow — Draft→Review→Revision→Final→Submitted, server-enforced. A
/// `WritingVersion` is append-only ("Không overwrite version cũ") — there is no endpoint
/// that edits an existing version's content, only `createVersion` (always a new row).
const WRITING_TRANSITIONS: Record<WritingStatus, WritingStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['REVISION', 'FINAL'],
  REVISION: ['REVIEW'],
  FINAL: ['SUBMITTED', 'REVISION'],
  SUBMITTED: [],
};

@Injectable()
export class WritingArtifactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<WritingArtifact[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.writingArtifact.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string) {
    const artifact = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, artifact.caseId);
    return this.prisma.writingArtifact.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { versionNumber: 'desc' } } } });
  }

  async create(principal: Principal, caseId: string, dto: CreateWritingArtifactDto): Promise<WritingArtifact> {
    await this.scope.assertCaseAccessible(principal, caseId);
    const ownerId = dto.ownerId ?? principal.userId;
    const [artifact] = await this.prisma.$transaction([
      this.prisma.writingArtifact.create({ data: { caseId, type: dto.type, title: dto.title, ownerId } }),
    ]);
    await this.prisma.writingVersion.create({
      data: { artifactId: artifact.id, versionNumber: 1, createdById: principal.userId, content: dto.content },
    });
    return artifact;
  }

  async updateStatus(principal: Principal, id: string, status: WritingStatus): Promise<WritingArtifact> {
    const artifact = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, artifact.caseId);
    const allowed = WRITING_TRANSITIONS[artifact.status];
    if (!allowed.includes(status)) {
      throw new ConflictException({
        code: 'INVALID_WRITING_STATUS_TRANSITION',
        message: `Cannot move Writing artifact from ${artifact.status} to ${status}.`,
        allowedTransitions: allowed,
      });
    }
    return this.prisma.writingArtifact.update({ where: { id }, data: { status } });
  }

  /// A new version while FINAL auto-reverts the artifact to REVISION — content changing
  /// after "final" was declared means it's being revised again, not still final.
  async createVersion(principal: Principal, artifactId: string, dto: CreateWritingVersionDto): Promise<WritingVersion> {
    const artifact = await this.findOrThrow(artifactId);
    await this.scope.assertCaseAccessible(principal, artifact.caseId);
    if (artifact.status === 'SUBMITTED') {
      throw new ConflictException({ code: 'WRITING_ARTIFACT_SUBMITTED', message: 'A Submitted writing artifact no longer accepts new versions.' });
    }

    const latest = await this.prisma.writingVersion.findFirst({ where: { artifactId }, orderBy: { versionNumber: 'desc' } });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const [version] = await this.prisma.$transaction([
      this.prisma.writingVersion.create({
        data: { artifactId, versionNumber: nextVersionNumber, createdById: principal.userId, content: dto.content, documentId: dto.documentId, changeSummary: dto.changeSummary },
      }),
      ...(artifact.status === 'FINAL' ? [this.prisma.writingArtifact.update({ where: { id: artifactId }, data: { status: 'REVISION' as const } })] : []),
    ]);
    return version;
  }

  async reviewVersion(principal: Principal, versionId: string, dto: ReviewWritingVersionDto): Promise<WritingVersion> {
    const version = await this.prisma.writingVersion.findUnique({ where: { id: versionId }, include: { artifact: true } });
    if (!version) throw new NotFoundException({ code: 'WRITING_VERSION_NOT_FOUND', message: `Writing version ${versionId} not found.` });
    await this.scope.assertCaseAccessible(principal, version.artifact.caseId);
    return this.prisma.writingVersion.update({
      where: { id: versionId },
      data: { reviewStatus: dto.reviewStatus, reviewerId: principal.userId, reviewedAt: new Date() },
    });
  }

  async getVersionForComment(principal: Principal, versionId: string): Promise<WritingVersion> {
    const version = await this.prisma.writingVersion.findUnique({ where: { id: versionId }, include: { artifact: true } });
    if (!version) throw new NotFoundException({ code: 'WRITING_VERSION_NOT_FOUND', message: `Writing version ${versionId} not found.` });
    await this.scope.assertCaseAccessible(principal, version.artifact.caseId);
    return version;
  }

  private async findOrThrow(id: string): Promise<WritingArtifact> {
    const artifact = await this.prisma.writingArtifact.findUnique({ where: { id } });
    if (!artifact) throw new NotFoundException({ code: 'WRITING_ARTIFACT_NOT_FOUND', message: `Writing artifact ${id} not found.` });
    return artifact;
  }
}
