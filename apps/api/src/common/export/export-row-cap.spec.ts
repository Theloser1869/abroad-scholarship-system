import { ConflictException } from '@nestjs/common';
import { EXPORT_ROW_CAP, ExportRowLimitExceededException, enforceExportRowCap } from './export-row-cap';

describe('enforceExportRowCap', () => {
  it('returns the rows unchanged when the count is under the cap', () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: i }));
    expect(enforceExportRowCap(rows, 'test scope')).toBe(rows);
  });

  it('returns the rows unchanged when the count is exactly at the cap', () => {
    const rows = Array.from({ length: EXPORT_ROW_CAP }, (_, i) => ({ id: i }));
    expect(enforceExportRowCap(rows, 'test scope')).toBe(rows);
    expect(enforceExportRowCap(rows, 'test scope')).toHaveLength(EXPORT_ROW_CAP);
  });

  it('throws a 409 EXPORT_ROW_LIMIT_EXCEEDED when the count is one over the cap', () => {
    const rows = Array.from({ length: EXPORT_ROW_CAP + 1 }, (_, i) => ({ id: i }));
    expect(() => enforceExportRowCap(rows, 'students in your scope')).toThrow(ExportRowLimitExceededException);
    expect(() => enforceExportRowCap(rows, 'students in your scope')).toThrow(ConflictException);
    try {
      enforceExportRowCap(rows, 'students in your scope');
      fail('expected enforceExportRowCap to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const response = (err as ConflictException).getResponse() as { code: string; message: string };
      expect(response.code).toBe('EXPORT_ROW_LIMIT_EXCEEDED');
      expect(response.message).toContain('students in your scope');
      expect(response.message).toContain(String(EXPORT_ROW_CAP));
    }
  });

  it('throws for a count far beyond the cap, never silently truncating', () => {
    const rows = Array.from({ length: EXPORT_ROW_CAP * 3 }, (_, i) => ({ id: i }));
    expect(() => enforceExportRowCap(rows, 'contracts in your scope')).toThrow(ExportRowLimitExceededException);
  });
});
