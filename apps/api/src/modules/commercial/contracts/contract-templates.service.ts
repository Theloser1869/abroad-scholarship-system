import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractTemplate } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';

/// Minimal template management — 05-commercial's "versioned template" requirement, scoped
/// to what `ContractsService.create`/`update` actually need (a template's merge-field
/// schema to fill values against). Not a full template-authoring/versioning UI backend —
/// that level of tooling isn't asked for by 05-commercial's instruction files.
@Injectable()
export class ContractTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<ContractTemplate[]> {
    return this.prisma.contractTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async getById(id: string): Promise<ContractTemplate> {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException({ code: 'CONTRACT_TEMPLATE_NOT_FOUND', message: `Contract template ${id} not found.` });
    return template;
  }

  async create(dto: CreateContractTemplateDto): Promise<ContractTemplate> {
    return this.prisma.contractTemplate.create({
      data: { code: dto.code, name: dto.name, mergeFields: (dto.mergeFields ?? undefined) as never, active: dto.active ?? true },
    });
  }
}
