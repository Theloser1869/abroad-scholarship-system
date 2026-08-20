import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PartnerDocument, Prisma, RoleCode } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentsService } from '../../documents/documents/documents.service';
import { CreatePartnerDocumentDto } from './dto/create-partner-document.dto';
import { PartnerDocumentQueryDto } from './dto/partner-document-query.dto';
import { UpdatePartnerDocumentDto } from './dto/update-partner-document.dto';

const SORTABLE_FIELDS = ['type', 'version', 'effectiveDate', 'expiryDate', 'createdAt'] as const;

/// Roles granted `partner_documents:view` in this phase's seed (docs/security/
/// RBAC_MATRIX.md) whose base `ScopeKind` isn't GLOBAL and therefore need an explicit
/// `DocumentAccess` grant row to actually read the linked Document — see
/// `DocumentsService.grantRoleAccess`.
const PARTNER_DOCUMENT_VIEWER_ROLES: RoleCode[] = ['EXECUTIVE_DIRECTOR', 'DEPARTMENT_MANAGER', 'ADMIN_FINANCE', 'DOCUMENT_SPECIALIST'];

/// 10-partners/01_PARTNER_CRM.md Documents section. Reuses the existing Document subsystem
/// (`documentId` real FK, Phase 07-09 ASM-24 precedent) — no PartnerFile/PartnerStorage
/// model. Legal/commercial documents are immutable once ACTIVE ("Không overwrite
/// signed/final partner documents") — a correction requires a brand-new version row
/// (`create` again for the same partner+type auto-increments `version`), never a PATCH of
/// an already-signed row.
@Injectable()
export class PartnerDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async listForPartner(partnerId: string, query: PartnerDocumentQueryDto): Promise<PaginatedResult<PartnerDocument>> {
    await this.assertPartnerExists(partnerId);
    await this.syncExpiredForPartner(partnerId);
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.PartnerDocumentWhereInput = {
      partnerId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.partnerDocument.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.partnerDocument.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<PartnerDocument> {
    const doc = await this.findOrThrow(id);
    return this.syncExpiredOne(doc);
  }

  /// version = (max existing version for this partner+type) + 1, always DRAFT — never
  /// jumps straight to ACTIVE (see `activate`).
  async create(partnerId: string, dto: CreatePartnerDocumentDto): Promise<PartnerDocument> {
    await this.assertPartnerExists(partnerId);
    const document = await this.prisma.document.findUnique({ where: { id: dto.documentId } });
    if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: `Document ${dto.documentId} not found.` });

    const latest = await this.prisma.partnerDocument.findFirst({
      where: { partnerId, type: dto.type },
      orderBy: { version: 'desc' },
    });
    const created = await this.prisma.partnerDocument.create({
      data: {
        partnerId,
        type: dto.type,
        version: (latest?.version ?? 0) + 1,
        documentId: dto.documentId,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        ownerId: dto.ownerId,
      },
    });
    await this.documents.grantRoleAccess(dto.documentId, PARTNER_DOCUMENT_VIEWER_ROLES);
    return created;
  }

  async update(id: string, dto: UpdatePartnerDocumentDto): Promise<PartnerDocument> {
    const doc = await this.findOrThrow(id);
    if (doc.status !== 'DRAFT') {
      throw new ConflictException({ code: 'PARTNER_DOCUMENT_NOT_EDITABLE', message: `This document is ${doc.status} and can only be edited while DRAFT.` });
    }
    if (dto.documentId) {
      const document = await this.prisma.document.findUnique({ where: { id: dto.documentId } });
      if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: `Document ${dto.documentId} not found.` });
      await this.documents.grantRoleAccess(dto.documentId, PARTNER_DOCUMENT_VIEWER_ROLES);
    }
    return this.prisma.partnerDocument.update({
      where: { id },
      data: {
        documentId: dto.documentId,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        ownerId: dto.ownerId,
      },
    });
  }

  /// DRAFT -> ACTIVE. Marks any previously ACTIVE row for the same (partnerId, type) as
  /// SUPERSEDED, atomically — at most one ACTIVE row per (partner, document type) at a
  /// time. From here the row is immutable (`update` above rejects it).
  async activate(id: string): Promise<PartnerDocument> {
    const doc = await this.findOrThrow(id);
    if (doc.status !== 'DRAFT') {
      throw new ConflictException({ code: 'INVALID_PARTNER_DOCUMENT_TRANSITION', message: `Only a DRAFT document can be activated (this one is ${doc.status}).` });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.partnerDocument.updateMany({
        where: { partnerId: doc.partnerId, type: doc.type, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      return tx.partnerDocument.update({ where: { id }, data: { status: 'ACTIVE' } });
    });
  }

  /// Manual archive — reachable from any non-ARCHIVED state (relationship ended, a DRAFT
  /// never signed, etc.). Terminal; no hard-delete (Hard Rule #5).
  async archive(id: string): Promise<PartnerDocument> {
    const doc = await this.findOrThrow(id);
    if (doc.status === 'ARCHIVED') {
      throw new ConflictException({ code: 'PARTNER_DOCUMENT_ALREADY_ARCHIVED', message: 'This document is already archived.' });
    }
    return this.prisma.partnerDocument.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  /// Lazy ACTIVE -> EXPIRED sweep past `expiryDate`, same "computed on read, not a
  /// scheduled job" pattern as `OffersService.syncExpired`/`PaymentsService`'s OVERDUE
  /// sweep.
  private async syncExpiredOne(doc: PartnerDocument): Promise<PartnerDocument> {
    if (doc.status === 'ACTIVE' && doc.expiryDate && doc.expiryDate < new Date()) {
      return this.prisma.partnerDocument.update({ where: { id: doc.id }, data: { status: 'EXPIRED' } });
    }
    return doc;
  }

  private async syncExpiredForPartner(partnerId: string): Promise<void> {
    await this.prisma.partnerDocument.updateMany({
      where: { partnerId, status: 'ACTIVE', expiryDate: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async assertPartnerExists(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${partnerId} not found.` });
    return partner;
  }

  private async findOrThrow(id: string): Promise<PartnerDocument> {
    const doc = await this.prisma.partnerDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException({ code: 'PARTNER_DOCUMENT_NOT_FOUND', message: `Partner document ${id} not found.` });
    return doc;
  }
}
