import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Partner, Prisma } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { IdGeneratorService } from '../../../common/id/id-generator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { PartnerQueryDto } from './dto/partner-query.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

const SORTABLE_FIELDS = ['name', 'countryCode', 'type', 'createdAt'] as const;

/// 10-partners/01_PARTNER_CRM.md Partner section. GLOBAL, permission-gated master/business
/// data — same treatment as University/Program (Phase 08) and VisaChecklistTemplate
/// (Phase 09): every granted role sees every row, no per-record scope filter. "Không tạo
/// duplicate Partner chỉ vì nhiều Program/Student/Application/Case/CommissionTransaction" —
/// every child entity below references this row by FK, never a copied name.
@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async list(query: PartnerQueryDto): Promise<PaginatedResult<Partner>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'name', direction: 'asc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.PartnerWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.countryCode ? { countryCode: query.countryCode.toUpperCase() } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.partner.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.partner.count({ where }),
    ]);
    return new PaginatedResult(data, new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<Partner> {
    return this.findOrThrow(id);
  }

  /// Service-layer duplicate check on (name, countryCode), case-insensitive — same
  /// treatment as University's (officialName, countryCode) check (Phase 08).
  async create(dto: CreatePartnerDto): Promise<Partner> {
    const countryCode = dto.countryCode.toUpperCase();
    const existing = await this.prisma.partner.findFirst({
      where: { countryCode, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PARTNER',
        message: `A partner named "${dto.name}" already exists in ${countryCode}.`,
        existingPartnerId: existing.id,
      });
    }

    const partnerCode = await this.idGenerator.nextCountryScopedCode('PT', countryCode);
    return this.prisma.partner.create({
      data: {
        partnerCode,
        name: dto.name,
        type: dto.type,
        countryCode,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        ownerId: dto.ownerId,
      },
    });
  }

  async update(id: string, dto: UpdatePartnerDto): Promise<Partner> {
    await this.findOrThrow(id);
    return this.prisma.partner.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : undefined,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        ownerId: dto.ownerId,
        internalNotes: dto.internalNotes,
        status: dto.status,
      },
    });
  }

  /// Dedicated action (distinct `ARCHIVE` audit verb from generic `EDIT`, same precedent
  /// as `students:archive`) — no hard-delete anywhere (Hard Rule #5).
  async archive(id: string): Promise<Partner> {
    await this.findOrThrow(id);
    return this.prisma.partner.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  private async findOrThrow(id: string): Promise<Partner> {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException({ code: 'PARTNER_NOT_FOUND', message: `Partner ${id} not found.` });
    return partner;
  }
}
