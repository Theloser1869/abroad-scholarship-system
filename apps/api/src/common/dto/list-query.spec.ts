import { BadRequestException } from '@nestjs/common';
import { PageMeta, parseSort } from './list-query.dto';

describe('parseSort', () => {
  const allowed = ['createdAt', 'fullName'] as const;
  const fallback = { field: 'createdAt', direction: 'desc' } as const;

  it('returns the fallback when no sort is given', () => {
    expect(parseSort(undefined, allowed, fallback)).toEqual(fallback);
  });

  it('parses a valid "field:direction" string', () => {
    expect(parseSort('fullName:asc', allowed, fallback)).toEqual({ field: 'fullName', direction: 'asc' });
  });

  it('rejects a field outside the whitelist', () => {
    expect(() => parseSort('email:asc', allowed, fallback)).toThrow(BadRequestException);
  });

  it('rejects an invalid direction', () => {
    expect(() => parseSort('fullName:sideways', allowed, fallback)).toThrow(BadRequestException);
  });
});

describe('PageMeta', () => {
  it('computes totalPages by rounding up', () => {
    const meta = new PageMeta(1, 20, 41);
    expect(meta.totalPages).toBe(3);
  });

  it('handles zero results', () => {
    const meta = new PageMeta(1, 20, 0);
    expect(meta.totalPages).toBe(0);
  });
});
