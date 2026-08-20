import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../../../common/audit/audit.interceptor';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CreatePartnerDocumentDto } from './dto/create-partner-document.dto';
import { PartnerDocumentQueryDto } from './dto/partner-document-query.dto';
import { UpdatePartnerDocumentDto } from './dto/update-partner-document.dto';
import { PartnerDocumentsService } from './partner-documents.service';

@Controller('partners/:partnerId/documents')
export class PartnerDocumentsNestedController {
  constructor(private readonly service: PartnerDocumentsService) {}

  @Get()
  @RequirePermission('partner_documents', 'view')
  async list(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Query() query: PartnerDocumentQueryDto) {
    return this.service.listForPartner(partnerId, query);
  }

  @Post()
  @RequirePermission('partner_documents', 'create')
  @Audit('CREATE')
  async create(@Param('partnerId', ParseUUIDPipe) partnerId: string, @Body() dto: CreatePartnerDocumentDto) {
    return this.service.create(partnerId, dto);
  }
}

@Controller('partner-documents')
export class PartnerDocumentsController {
  constructor(private readonly service: PartnerDocumentsService) {}

  @Get(':id')
  @RequirePermission('partner_documents', 'view')
  @Audit('VIEW')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @RequirePermission('partner_documents', 'edit')
  @Audit('EDIT')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDocumentDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  @RequirePermission('partner_documents', 'edit')
  @Audit('EDIT')
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }

  @Post(':id/archive')
  @RequirePermission('partner_documents', 'edit')
  @Audit('ARCHIVE')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }
}
