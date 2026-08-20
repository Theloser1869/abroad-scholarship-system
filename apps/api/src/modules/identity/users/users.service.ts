import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DEFAULT_PAGE_SIZE, PageMeta, PaginatedResult, parseSort } from '../../../common/dto/list-query.dto';
import { SessionService } from '../auth/session.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const SORTABLE_FIELDS = ['createdAt', 'username', 'fullName'] as const;

/// SRS 6.1 "User có trạng thái Active/Suspended/Offboarded; offboarding phải thu hồi
/// role, refresh token, API token và quyền tải file" + AC-14. Admin-only user-lifecycle
/// operations — this is NOT the Student/Case business identity model, it's the operator/
/// staff account model backing the `identity` domain (docs/architecture/DOMAIN_MAP.md).
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedResult<Omit<User, 'passwordHash'>>> {
    const { field, direction } = parseSort(query.sort, SORTABLE_FIELDS, { field: 'createdAt', direction: 'desc' });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where = query.search
      ? { OR: [{ username: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
      : {};

    const [rows, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { [field]: direction }, skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
    ]);
    return new PaginatedResult(rows.map(stripPasswordHash), new PageMeta(page, limit, totalItems));
  }

  async getById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${id} not found.` });
    return stripPasswordHash(user);
  }

  async suspend(id: string): Promise<Omit<User, 'passwordHash'>> {
    await this.getById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await this.sessions.revokeAllForUser(id);
    return stripPasswordHash(user);
  }

  async reactivate(id: string): Promise<Omit<User, 'passwordHash'>> {
    await this.getById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null } });
    return stripPasswordHash(user);
  }

  /// AC-14: offboarding must revoke access in new sessions AND kill active ones — status
  /// flip alone would only stop *future* logins; the explicit revokeAllForUser call is
  /// what invalidates whatever the person is logged into right now.
  async offboard(id: string): Promise<Omit<User, 'passwordHash'>> {
    await this.getById(id);
    const user = await this.prisma.user.update({ where: { id }, data: { status: 'OFFBOARDED', offboardedAt: new Date() } });
    await this.sessions.revokeAllForUser(id);
    return stripPasswordHash(user);
  }
}

function stripPasswordHash(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
