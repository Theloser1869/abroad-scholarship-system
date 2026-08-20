import { Injectable, NotFoundException } from '@nestjs/common';
import { LetterOfRecommendation } from '@prisma/client';
import { Principal } from '../../../common/context/principal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreateLorDto } from './dto/create-lor.dto';
import { UpdateLorDto } from './dto/update-lor.dto';

/// 03_WRITING.md LOR fields — its own entity, not a `WritingArtifact` typed "LOR" (its
/// recommender/request/submission tracking shape has nothing in common with
/// `WritingVersion`'s content/review shape).
@Injectable()
export class LorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopePolicyService,
    private readonly documents: DocumentsService,
  ) {}

  async listForCase(principal: Principal, caseId: string): Promise<LetterOfRecommendation[]> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.letterOfRecommendation.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(principal: Principal, id: string): Promise<LetterOfRecommendation> {
    const lor = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, lor.caseId);
    return lor;
  }

  async create(principal: Principal, caseId: string, dto: CreateLorDto): Promise<LetterOfRecommendation> {
    await this.scope.assertCaseAccessible(principal, caseId);
    return this.prisma.letterOfRecommendation.create({
      data: {
        caseId,
        recommenderName: dto.recommenderName,
        relationship: dto.relationship,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        internalNotes: dto.internalNotes,
        requestDate: dto.requestDate ? new Date(dto.requestDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        requestStatus: dto.requestDate ? 'REQUESTED' : 'NOT_REQUESTED',
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateLorDto): Promise<LetterOfRecommendation> {
    const lor = await this.findOrThrow(id);
    await this.scope.assertCaseAccessible(principal, lor.caseId);
    const updated = await this.prisma.letterOfRecommendation.update({
      where: { id },
      data: {
        recommenderName: dto.recommenderName,
        relationship: dto.relationship,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        internalNotes: dto.internalNotes,
        requestDate: dto.requestDate ? new Date(dto.requestDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        requestStatus: dto.requestStatus,
        submissionStatus: dto.submissionStatus,
        evidenceDocumentId: dto.evidenceDocumentId,
      },
    });
    if (dto.evidenceDocumentId) await this.documents.grantCaseAccess(dto.evidenceDocumentId, lor.caseId);
    return updated;
  }

  private async findOrThrow(id: string): Promise<LetterOfRecommendation> {
    const lor = await this.prisma.letterOfRecommendation.findUnique({ where: { id } });
    if (!lor) throw new NotFoundException({ code: 'LOR_NOT_FOUND', message: `Letter of recommendation ${id} not found.` });
    return lor;
  }
}
