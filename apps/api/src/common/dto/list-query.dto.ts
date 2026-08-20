import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/// Shared query-string contract for every list endpoint (02_API_FOUNDATION.md
/// "pagination / filter / sorting / search"). Page-based (not cursor-based) pagination —
/// documented as the chosen convention in docs/api/API_CONVENTIONS.md. Endpoint-specific
/// filters extend this class rather than re-declaring page/limit/sort/search.
export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  /// Format: `field:asc` or `field:desc`. Whitelisting which fields are sortable is left
  /// to each endpoint (it knows its own column set); this DTO only validates the shape.
  @IsOptional()
  @IsString()
  sort?: string;

  /// Free-text search — each endpoint decides which columns it searches against.
  @IsOptional()
  @IsString()
  search?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface ParsedSort {
  field: string;
  direction: SortDirection;
}

/// Parses `sort=field:direction` against a caller-supplied whitelist of sortable fields.
/// Throwing on an unknown field/direction is deliberate — silently ignoring a bad sort
/// param would look like the API accepted it.
export function parseSort(sort: string | undefined, allowedFields: readonly string[], fallback: ParsedSort): ParsedSort {
  if (!sort) {
    return fallback;
  }
  const [field, direction] = sort.split(':');
  if (!field || !allowedFields.includes(field)) {
    throw badSort(sort, allowedFields);
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw badSort(sort, allowedFields);
  }
  return { field, direction };
}

function badSort(sort: string, allowedFields: readonly string[]) {
  return new BadRequestException({
    code: 'INVALID_SORT',
    message: `Invalid sort "${sort}". Expected one of [${allowedFields.join(', ')}] followed by :asc or :desc.`,
  });
}

export class PageMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;

  constructor(page: number, limit: number, totalItems: number) {
    this.page = page;
    this.limit = limit;
    this.totalItems = totalItems;
    this.totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 0;
  }
}

/// Shared envelope for every list endpoint response.
export class PaginatedResult<T> {
  data: T[];
  meta: PageMeta;

  constructor(data: T[], meta: PageMeta) {
    this.data = data;
    this.meta = meta;
  }
}
