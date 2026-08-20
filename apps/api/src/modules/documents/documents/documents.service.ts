import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document, DocumentAccessPermission, RoleCode } from '@prisma/client';
import { JobsService } from '../../../common/jobs/jobs.service';
import {
  DEFAULT_MAX_DOCUMENT_SIZE_BYTES,
  normalizeFilename,
  validateMagicBytes,
  validateMimeAndExtension,
  validateSize,
} from '../../../common/storage/file-validation.util';
import { SignedUrlService } from '../../../common/storage/signed-url.service';
import { STORAGE_PROVIDER, StorageProvider } from '../../../common/storage/storage-provider.interface';
import { Principal } from '../../../common/context/principal';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ScopeKind, ScopePolicyService } from '../../identity/rbac/scope-policy.service';
import { ShareDocumentDto } from './dto/share-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

export const DOCUMENT_SCAN_JOB_TYPE = 'DOCUMENT_SCAN';

export interface UploadResult {
  document: Document;
  duplicateOfId: string | null;
}

/// docs/architecture/DOMAIN_MAP.md domain 9 (Documents) — "1 trong 5 trục dữ liệu xuyên
/// suốt," owned by no other domain. Phase 12 completes what Phase 07 deliberately left as
/// metadata-only: real private-storage upload (`StorageProvider`), async malware scan
/// (`MalwareScanProvider` via a queued job), checksum/MIME/size/magic-byte validation, a
/// short-lived signed download flow, versioning (never overwrite), and EDIT/SHARE/ARCHIVE.
/// Access remains grant-based (`DocumentAccess`) exactly as Phase 07 built it — Phase 12
/// adds no new access-control mechanism, only new actions gated by the SAME grant check.
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
    private readonly scope: ScopePolicyService,
    private readonly jobs: JobsService,
    private readonly signedUrl: SignedUrlService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /// Authenticate → resolve principal (controller) → [this method: validate, store,
  /// persist metadata, grant uploader control, enqueue scan] — the "authorization before
  /// URL generation" half of the flow happens later, at download time, not here; upload
  /// authorization is the `documents:create` permission check the controller's
  /// `@RequirePermission` already performs.
  async upload(principal: Principal, dto: UploadDocumentDto, file: Express.Multer.File): Promise<UploadResult> {
    const allowed = validateMimeAndExtension(file.mimetype, file.originalname);
    const maxBytes = Number(this.config.get<string>('DOCUMENT_MAX_SIZE_BYTES') ?? String(DEFAULT_MAX_DOCUMENT_SIZE_BYTES));
    validateSize(file.size, maxBytes);
    validateMagicBytes(file.buffer, allowed);

    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
    // Duplicate detection is informational only (12-platform/01_DOCUMENTS.md "duplicate
    // detection nếu được yêu cầu" — no MD names a blocking rule) — the caller decides
    // whether to proceed; upload is never rejected for it. See docs/ASSUMPTIONS.md ASM-50.
    const duplicate = await this.prisma.document.findFirst({
      where: { ownerEntity: dto.ownerEntity, ownerId: dto.ownerId, checksumSha256, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const { storageKey } = await this.storage.store(file.buffer);
    const documentCode = await this.idGenerator.nextYearlyCode('DOC');
    const document = await this.prisma.document.create({
      data: {
        documentCode,
        ownerEntity: dto.ownerEntity,
        ownerId: dto.ownerId,
        documentType: dto.documentType,
        title: dto.title,
        fileReference: storageKey,
        originalFilename: normalizeFilename(file.originalname),
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksumSha256,
        uploadedById: principal.userId,
      },
    });
    // Uploader retains full control of their own upload — VIEW/DOWNLOAD (existing Phase 07
    // behavior) plus EDIT/SHARE (Phase 12's new actions), so the person who created a
    // document isn't locked out of managing it.
    await this.grant(document.id, principal.userId, ['VIEW', 'DOWNLOAD', 'EDIT', 'SHARE']);
    await this.jobs.enqueue(DOCUMENT_SCAN_JOB_TYPE, { documentId: document.id }, { dedupeKey: `document-scan:${document.id}` });

    return { document, duplicateOfId: duplicate?.id ?? null };
  }

  async getById(principal: Principal, id: string): Promise<Document> {
    await this.assertAccessible(principal, id, 'VIEW');
    return this.findOrThrow(id);
  }

  /// Phase 11 (Portal) — "Không cho Portal enumerate arbitrary document IDs... nếu document
  /// chưa được share, portal phải không thấy document." Lists exactly the Documents the
  /// caller currently holds a non-expired VIEW grant for (the same `DocumentAccess` table
  /// `assertAccessible` already checks, queried from the "which grants do I hold" side
  /// instead of "does this one grant exist") — never a generic by-owner-entity scan.
  /// GLOBAL-scope roles use the regular staff document endpoints, not this one.
  async listAccessibleTo(principal: Principal): Promise<Document[]> {
    const grants = await this.prisma.documentAccess.findMany({
      where: { principalId: principal.userId, permission: 'VIEW', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { document: true },
      orderBy: { document: { createdAt: 'desc' } },
    });
    return grants.map((g) => g.document);
  }

  /// The "Authorize document" step of the required Download flow (Authenticate → Resolve
  /// principal → Authorize document → Audit → Generate secure access → Download) — the
  /// Audit step happens in the controller (`@Audit('DOWNLOAD')`), then this method's
  /// signed token IS the "Generate secure access" step. Blocks on `scanStatus !== CLEAN`
  /// regardless of who's asking — an infected/still-pending file is never downloadable by
  /// anyone, including the uploader or a GLOBAL-scope role.
  async requestDownload(principal: Principal, id: string): Promise<{ downloadUrl: string; document: Document }> {
    await this.assertAccessible(principal, id, 'DOWNLOAD');
    const document = await this.findOrThrow(id);
    if (document.scanStatus !== 'CLEAN') {
      throw new ForbiddenException({
        code: 'DOCUMENT_NOT_READY',
        message: `This document cannot be downloaded yet (scan status: ${document.scanStatus}).`,
      });
    }
    const token = this.signedUrl.sign(document.id, principal.userId);
    return { downloadUrl: `/documents/download/${token}`, document };
  }

  /// The un-authenticated byte-serving endpoint's own logic — the signed token IS the
  /// authorization for this one short-lived request (same "token possession = access"
  /// pattern as `ContractReviewLink`/`ParentInvitation`), re-verified against the DB grant
  /// AND scan status again here (defense-in-depth: a grant revoked or a document
  /// re-flagged INFECTED in the ~60s between requesting and using the URL must still take
  /// effect immediately).
  async downloadByToken(token: string): Promise<{ document: Document; buffer: Buffer }> {
    const payload = this.signedUrl.verify(token);
    if (!payload) throw new ForbiddenException({ code: 'INVALID_OR_EXPIRED_DOWNLOAD_TOKEN', message: 'This download link is invalid or has expired.' });

    const document = await this.findOrThrow(payload.documentId);
    if (document.scanStatus !== 'CLEAN') {
      throw new ForbiddenException({ code: 'DOCUMENT_NOT_READY', message: 'This document is not currently downloadable.' });
    }
    // Phase 13 fix: `requestDownload`'s `assertAccessible` lets GLOBAL-scope roles (ED/DM)
    // through without requiring a `DocumentAccess` row — but this step re-checked authorization
    // via a raw grant-row lookup only, so a GLOBAL-scope caller with no personal grant (the
    // normal case for a document they never uploaded/were shared) got a valid `downloadUrl`
    // from step 1 and then a 403 here. Re-derive the same GLOBAL bypass from the token's
    // principalId so both steps agree on who's authorized.
    const requester = await this.prisma.user.findUnique({ where: { id: payload.principalId }, select: { role: { select: { code: true } } } });
    const isGlobalScope = requester ? this.scope.scopeKindFor(requester.role.code) === ScopeKind.GLOBAL : false;
    if (!isGlobalScope) {
      const grant = await this.prisma.documentAccess.findUnique({
        where: { documentId_principalId_permission: { documentId: document.id, principalId: payload.principalId, permission: 'DOWNLOAD' } },
      });
      if (!grant || (grant.expiresAt && grant.expiresAt < new Date())) {
        throw new ForbiddenException({ code: 'DOCUMENT_ACCESS_EXPIRED', message: 'This access grant is no longer valid.' });
      }
    }
    const buffer = await this.storage.read(document.fileReference);
    return { document, buffer };
  }

  async update(principal: Principal, id: string, dto: UpdateDocumentDto): Promise<Document> {
    await this.assertAccessible(principal, id, 'EDIT');
    const existing = await this.findOrThrow(id);
    if (existing.status === 'ARCHIVED') {
      throw new ConflictException({ code: 'DOCUMENT_ARCHIVED', message: 'An archived document cannot be edited.' });
    }
    return this.prisma.document.update({ where: { id }, data: { title: dto.title, documentType: dto.documentType } });
  }

  async share(principal: Principal, id: string, dto: ShareDocumentDto): Promise<void> {
    await this.assertAccessible(principal, id, 'SHARE');
    await this.findOrThrow(id);
    await this.grant(id, dto.principalId, dto.permissions);
  }

  async archive(principal: Principal, id: string): Promise<Document> {
    await this.assertAccessible(principal, id, 'EDIT');
    const existing = await this.findOrThrow(id);
    if (existing.status === 'ARCHIVED') return existing;
    return this.prisma.document.update({ where: { id }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
  }

  /// "Final/submitted/legal files require versioning ... không overwrite ... tạo version
  /// mới ... không làm mất history." Always a brand-new Document row (own id, own
  /// `documentCode`) chained via `previousVersionId` — never an in-place content swap.
  /// Existing grants are copied forward so nobody loses access to a corrected document.
  async createVersion(principal: Principal, id: string, file: Express.Multer.File): Promise<UploadResult> {
    await this.assertAccessible(principal, id, 'EDIT');
    const previous = await this.findOrThrow(id);
    if (previous.status === 'ARCHIVED') {
      throw new ConflictException({ code: 'DOCUMENT_ARCHIVED', message: 'An archived document cannot be superseded by a new version.' });
    }

    const allowed = validateMimeAndExtension(file.mimetype, file.originalname);
    const maxBytes = Number(this.config.get<string>('DOCUMENT_MAX_SIZE_BYTES') ?? String(DEFAULT_MAX_DOCUMENT_SIZE_BYTES));
    validateSize(file.size, maxBytes);
    validateMagicBytes(file.buffer, allowed);
    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');

    const { storageKey } = await this.storage.store(file.buffer);
    const documentCode = await this.idGenerator.nextYearlyCode('DOC');
    const nextVersion = await this.prisma.document.create({
      data: {
        documentCode,
        ownerEntity: previous.ownerEntity,
        ownerId: previous.ownerId,
        documentType: previous.documentType,
        title: previous.title,
        version: previous.version + 1,
        previousVersionId: previous.id,
        fileReference: storageKey,
        originalFilename: normalizeFilename(file.originalname),
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksumSha256,
        uploadedById: principal.userId,
      },
    });

    const existingGrants = await this.prisma.documentAccess.findMany({ where: { documentId: previous.id } });
    for (const g of existingGrants) {
      await this.grant(nextVersion.id, g.principalId, [g.permission]);
    }
    await this.jobs.enqueue(DOCUMENT_SCAN_JOB_TYPE, { documentId: nextVersion.id }, { dedupeKey: `document-scan:${nextVersion.id}` });

    return { document: nextVersion, duplicateOfId: null };
  }

  /// Called by the `DOCUMENT_SCAN_JOB_TYPE` job processor once `MalwareScanProvider.scan`
  /// returns — the only place `scanStatus` moves out of PENDING.
  async applyScanResult(documentId: string, clean: boolean): Promise<void> {
    await this.prisma.document.update({ where: { id: documentId }, data: { scanStatus: clean ? 'CLEAN' : 'INFECTED' } });
  }

  /// Called by evidence/writing services immediately after linking a Document to a
  /// Case-scoped record — grants VIEW+DOWNLOAD to every current CaseMember plus the
  /// Case's linked student/parent portal users, so "document permission... case scope...
  /// student access" (07-profile/02_PROFILE_EVIDENCE.md) is satisfied without a generic
  /// polymorphic resolver.
  ///
  /// `viewOnlyForRoles` (Phase 13 fix) — SRS §13's field-level matrix gives Consultant only
  /// "Xem hạn chế" (restricted view) on Visa evidence, vs full view for Document
  /// Specialist/GĐĐH/Trưởng phòng; §6.14 asks for visa-sensitive documents to carry their
  /// "own" download permission, separate from the generic case-document grant. Every other
  /// evidence-bearing module (Assessment/Roadmap/Profile/Writing/Application/Scholarship/
  /// Enrollment/Pre-departure) keeps the prior uniform VIEW+DOWNLOAD-for-every-member
  /// behavior — only Visa's call sites pass this option. Portal (student/parent) recipients
  /// are never CaseMembers, so they're unaffected either way (SRS: HS/PH "V của mình").
  async grantCaseAccess(documentId: string, caseId: string, options?: { viewOnlyForRoles?: RoleCode[] }): Promise<void> {
    const [members, caseRecord] = await Promise.all([
      this.prisma.caseMember.findMany({ where: { caseId, removedAt: null }, include: { user: { select: { role: { select: { code: true } } } } } }),
      this.prisma.case.findUnique({ where: { id: caseId }, include: { student: { include: { contacts: true } } } }),
    ]);

    const viewOnlyRoles = new Set(options?.viewOnlyForRoles ?? []);
    const permissionsByUserId = new Map<string, DocumentAccessPermission[]>();
    for (const member of members) {
      permissionsByUserId.set(member.userId, viewOnlyRoles.has(member.user.role.code) ? ['VIEW'] : ['VIEW', 'DOWNLOAD']);
    }
    if (caseRecord?.student.portalUserId && !permissionsByUserId.has(caseRecord.student.portalUserId)) {
      permissionsByUserId.set(caseRecord.student.portalUserId, ['VIEW', 'DOWNLOAD']);
    }
    for (const contact of caseRecord?.student.contacts ?? []) {
      if (contact.portalUserId && !permissionsByUserId.has(contact.portalUserId)) {
        permissionsByUserId.set(contact.portalUserId, ['VIEW', 'DOWNLOAD']);
      }
    }

    for (const [userId, permissions] of permissionsByUserId) {
      await this.grant(documentId, userId, permissions);
    }
  }

  /// Phase 10 (Partners) — Partner-domain records are GLOBAL permission-gated, not
  /// Case-scoped, so there is no `grantCaseAccess`-style membership list to walk. Called by
  /// `PartnerDocumentsService` immediately after linking a Document, granting every current
  /// user of the given roles VIEW+DOWNLOAD — a one-time snapshot grant, same "grant at
  /// link time, not live-recomputed on every read" precedent as `grantCaseAccess`.
  async grantRoleAccess(documentId: string, roleCodes: RoleCode[]): Promise<void> {
    const users = await this.prisma.user.findMany({ where: { role: { code: { in: roleCodes } } }, select: { id: true } });
    for (const user of users) {
      await this.grant(documentId, user.id, ['VIEW', 'DOWNLOAD']);
    }
  }

  private async grant(documentId: string, principalId: string, permissions: DocumentAccessPermission[]): Promise<void> {
    for (const permission of permissions) {
      await this.prisma.documentAccess.upsert({
        where: { documentId_principalId_permission: { documentId, principalId, permission } },
        update: {},
        create: { documentId, principalId, permission },
      });
    }
  }

  /// GLOBAL-scope roles bypass (same `ROLE_SCOPE` reuse as every other Phase 07 resource);
  /// everyone else needs an explicit `DocumentAccess` grant row. 404, not 403, for a
  /// document that exists but isn't granted — same AC-02 non-enumeration pattern used
  /// everywhere else. IDOR note: changing `ownerId`/`ownerEntity` on the upload request
  /// grants no extra access — this check never reads those fields, only the grant table.
  private async assertAccessible(principal: Principal, documentId: string, permission: DocumentAccessPermission): Promise<void> {
    if (this.scope.scopeKindFor(principal.roleCode) === ScopeKind.GLOBAL) return;
    const grant = await this.prisma.documentAccess.findUnique({
      where: { documentId_principalId_permission: { documentId, principalId: principal.userId, permission } },
    });
    if (!grant) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: `Document ${documentId} not found.` });
    if (grant.expiresAt && grant.expiresAt < new Date()) {
      throw new ForbiddenException({ code: 'DOCUMENT_ACCESS_EXPIRED', message: 'This access grant has expired.' });
    }
  }

  private async findOrThrow(id: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: `Document ${id} not found.` });
    return document;
  }
}
