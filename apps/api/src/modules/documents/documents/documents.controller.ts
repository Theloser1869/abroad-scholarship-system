import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response, Request } from 'express';
import { Audit } from '../../../common/audit/audit.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Principal } from '../../../common/context/principal';
import { requirePrincipal } from '../../../common/http/require-principal.util';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { DEFAULT_MAX_DOCUMENT_SIZE_BYTES } from '../../../common/storage/file-validation.util';
import { ShareDocumentDto } from './dto/share-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

/// Phase 12 — multipart upload buffers into memory (`multer.memoryStorage()`, never a temp
/// file on disk under a client-influenced name), so `StorageProvider.store` receives a
/// plain `Buffer` regardless of which provider is bound. Size is double-capped: multer's
/// own `limits.fileSize` rejects an oversized request early (before fully buffering; a
/// generous fixed ceiling, not the tunable business limit), `DocumentsService.upload`'s
/// `validateSize` is the authoritative, configurable check (`DOCUMENT_MAX_SIZE_BYTES`).
const uploadInterceptorOptions = { storage: memoryStorage(), limits: { fileSize: DEFAULT_MAX_DOCUMENT_SIZE_BYTES * 4 } };

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @RequirePermission('documents', 'create')
  @Audit('CREATE')
  @UseInterceptors(FileInterceptor('file', uploadInterceptorOptions))
  async upload(
    @CurrentUser() principal: Principal | null,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'A file must be attached under the "file" field.' });
    const result = await this.documents.upload(requirePrincipal(principal), dto, file);
    req.auditMetadata = { documentId: result.document.id, duplicateOfId: result.duplicateOfId };
    // duplicateOfId is informational only — 12-platform/01_DOCUMENTS.md "duplicate
    // detection nếu được yêu cầu," never blocking (see docs/ASSUMPTIONS.md ASM-50).
    return { ...result.document, duplicateOfId: result.duplicateOfId };
  }

  @Get(':id')
  @RequirePermission('documents', 'view')
  @Audit('VIEW')
  async getById(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.getById(requirePrincipal(principal), id);
  }

  @Patch(':id')
  @RequirePermission('documents', 'edit')
  @Audit('EDIT')
  async update(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto) {
    return this.documents.update(requirePrincipal(principal), id, dto);
  }

  @Post(':id/share')
  @RequirePermission('documents', 'share')
  @Audit('SHARE')
  async share(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDocumentDto, @Req() req: Request) {
    await this.documents.share(requirePrincipal(principal), id, dto);
    req.auditMetadata = { documentId: id, sharedWithPrincipalId: dto.principalId, permissions: dto.permissions };
    return { shared: true };
  }

  @Post(':id/archive')
  @RequirePermission('documents', 'archive')
  @Audit('ARCHIVE')
  async archive(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.archive(requirePrincipal(principal), id);
  }

  @Post(':id/versions')
  @RequirePermission('documents', 'edit')
  @Audit('EDIT')
  @UseInterceptors(FileInterceptor('file', uploadInterceptorOptions))
  async createVersion(
    @CurrentUser() principal: Principal | null,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'A file must be attached under the "file" field.' });
    const result = await this.documents.createVersion(requirePrincipal(principal), id, file);
    req.auditMetadata = { documentId: result.document.id, previousVersionId: id };
    return result.document;
  }

  /// Download flow step 1: Authenticate → Resolve principal → Authorize → Audit → Generate
  /// secure access. Returns a short-lived signed URL, never the file bytes directly and
  /// never a permanent/public URL — 12-platform/01_DOCUMENTS.md "Không: GET
  /// /documents/:id/file trả permanent URL mà không authorization."
  @Get(':id/download')
  @RequirePermission('documents', 'download')
  @Audit('DOWNLOAD')
  async requestDownload(@CurrentUser() principal: Principal | null, @Param('id', ParseUUIDPipe) id: string) {
    const { downloadUrl } = await this.documents.requestDownload(requirePrincipal(principal), id);
    return { downloadUrl };
  }

  /// Download flow step 2: the actual byte-serving endpoint. Deliberately unauthenticated
  /// at the RBAC-guard layer (`@Public()`) — the signed token from step 1 IS the
  /// authorization for this one short-lived request, re-verified (signature, expiry, live
  /// grant, live scan status) inside `downloadByToken` itself. Never reachable without
  /// first passing step 1's full authorize-and-audit gate.
  @Public()
  @Get('download/:token')
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    const { document, buffer } = await this.documents.downloadByToken(token);
    res.setHeader('Content-Type', document.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename ?? document.documentCode}"`);
    res.send(buffer);
  }
}
