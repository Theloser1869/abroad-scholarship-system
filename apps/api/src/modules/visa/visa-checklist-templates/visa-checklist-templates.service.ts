import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VisaChecklistTemplate } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateVisaChecklistTemplateDto } from './dto/create-visa-checklist-template.dto';
import { UpdateVisaChecklistTemplateDto } from './dto/update-visa-checklist-template.dto';
import { VisaChecklistTemplateQueryDto } from './dto/visa-checklist-template-query.dto';

const SORTABLE_FIELDS = ['countryCode', 'visaType', 'sortOrder', 'createdAt'] as const;

/// 09-visa/01_VISA.md "Checklist configurable by country + visa type." GLOBAL, permission-
/// gated master data — same treatment as `admission_master` (Phase 08). Active templates
/// matching a Visa's (countryCode, visaType) are instantiated into real `VisaChecklistItem`
/// rows by `VisasService.create`, not read dynamically on every checklist view.
@Injectable()
export class VisaChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: VisaChecklistTemplateQueryDto): Promise<PaginatedResult<VisaChecklistTemplate>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'sortOrder', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.VisaChecklistTemplateWhereInput = {
      ...(query.countryCode ? { countryCode: query.countryCode.toUpperCase() } : {}),
      ...(query.visaType ? { visaType: query.visaType } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.visaChecklistTemplate.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.visaChecklistTemplate.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<VisaChecklistTemplate> {
    return this.findOrThrow(id);
  }

  async create(dto: CreateVisaChecklistTemplateDto): Promise<VisaChecklistTemplate> {
    const countryCode = dto.countryCode.toUpperCase();
    const existing = await this.prisma.visaChecklistTemplate.findUnique({
      where: { countryCode_visaType_title: { countryCode, visaType: dto.visaType, title: dto.title } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_VISA_CHECKLIST_TEMPLATE',
        message: `A checklist template "${dto.title}" already exists for ${countryCode}/${dto.visaType}.`,
        existingTemplateId: existing.id,
      });
    }
    return this.prisma.visaChecklistTemplate.create({
      data: { countryCode, visaType: dto.visaType, title: dto.title, required: dto.required, sortOrder: dto.sortOrder, active: dto.active },
    });
  }

  async update(id: string, dto: UpdateVisaChecklistTemplateDto): Promise<VisaChecklistTemplate> {
    await this.findOrThrow(id);
    return this.prisma.visaChecklistTemplate.update({
      where: { id },
      data: {
        countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : undefined,
        visaType: dto.visaType,
        title: dto.title,
        required: dto.required,
        sortOrder: dto.sortOrder,
        active: dto.active,
      },
    });
  }

  private async findOrThrow(id: string): Promise<VisaChecklistTemplate> {
    const template = await this.prisma.visaChecklistTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException({ code: 'VISA_CHECKLIST_TEMPLATE_NOT_FOUND', message: `Visa checklist template ${id} not found.` });
    return template;
  }
}
