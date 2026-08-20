import { DuplicateDetectionService } from './duplicate-detection.service';

describe('DuplicateDetectionService', () => {
  const findMany = jest.fn();
  const prisma = { student: { findMany } };
  const service = new DuplicateDetectionService(prisma as never);

  beforeEach(() => findMany.mockReset());

  it('returns nothing and does not query when no matchable input is given', async () => {
    const result = await service.findPotentialDuplicateStudents({});
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('builds an OR clause with email and phone but no name+DOB when DOB is missing', async () => {
    findMany.mockResolvedValue([]);
    await service.findPotentialDuplicateStudents({ email: 'a@b.com', phone: '123', fullName: 'Jane Doe' });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
    expect(where.OR).toEqual([
      { email: { equals: 'a@b.com', mode: 'insensitive' } },
      { phone: '123' },
    ]);
  });

  it('only matches on name when paired with dateOfBirth (never name alone)', async () => {
    findMany.mockResolvedValue([]);
    const dob = new Date('2005-01-01');
    await service.findPotentialDuplicateStudents({ fullName: 'Jane Doe', dateOfBirth: dob });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ fullName: { equals: 'Jane Doe', mode: 'insensitive' }, dateOfBirth: dob }]);
  });

  it('excludes archived students from the match', async () => {
    findMany.mockResolvedValue([]);
    await service.findPotentialDuplicateStudents({ email: 'a@b.com' });
    expect(findMany.mock.calls[0][0].where.archivedAt).toBeNull();
  });
});
