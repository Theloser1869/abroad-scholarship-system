import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  const auditFindMany = jest.fn();
  const commentFindMany = jest.fn();
  const prisma = { auditLog: { findMany: auditFindMany }, comment: { findMany: commentFindMany } };
  const service = new TimelineService(prisma as never);

  beforeEach(() => {
    auditFindMany.mockReset();
    commentFindMany.mockReset();
  });

  it('merges audit rows and comment rows into one list, sorted newest first', async () => {
    auditFindMany.mockResolvedValue([{ action: 'CREATE', result: 'SUCCESS', actorId: 'u1', createdAt: new Date('2026-01-01T10:00:00Z') }]);
    commentFindMany.mockResolvedValue([{ body: 'hello', visibility: 'internal', authorId: 'u2', createdAt: new Date('2026-01-02T10:00:00Z') }]);

    const result = await service.forEntity('Leads', 'Lead', 'lead-1', ['internal', 'shared']);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('NOTE');
    expect(result[1].type).toBe('AUDIT');
  });

  it('filters comments by the caller-supplied visibility set before querying', async () => {
    auditFindMany.mockResolvedValue([]);
    commentFindMany.mockResolvedValue([]);
    await service.forEntity('Students', 'Student', 'student-1', ['shared']);
    expect(commentFindMany.mock.calls[0][0].where.visibility).toEqual({ in: ['shared'] });
  });

  it('returns an empty list when neither source has rows', async () => {
    auditFindMany.mockResolvedValue([]);
    commentFindMany.mockResolvedValue([]);
    const result = await service.forEntity('Cases', 'Case', 'case-1', ['internal', 'shared']);
    expect(result).toEqual([]);
  });
});
