import { Injectable } from '@nestjs/common';
import { Student } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface DuplicateCandidateInput {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  dateOfBirth?: Date | null;
}

/// SRS 6.2: "Không tạo duplicate student khi lead chuyển đổi; hệ thống phải match email/
/// phone/name+DOB và cho người dùng xác nhận merge." 04-core-crm/01_LEAD.md: "Duplicate
/// detection: email, phone, name+DOB." A single, reusable matcher — used by
/// `LeadsService.convert` (the only place this phase wires it up; the generic
/// `POST /students` reference endpoint from Phase 02 deliberately stays a raw primitive,
/// per its own code comment — this service does not change that).
@Injectable()
export class DuplicateDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /// Returns every non-archived Student matching on email, phone, OR (fullName + DOB) —
  /// three independent match rules, any one of which is enough to flag a candidate. Never
  /// matches on name alone (Hard Rule: "Không dùng name làm foreign key" — name alone is
  /// never sufficient to identify a record, only name+DOB together is treated as a signal).
  async findPotentialDuplicateStudents(input: DuplicateCandidateInput): Promise<Student[]> {
    const clauses: Array<Record<string, unknown>> = [];
    if (input.email) {
      clauses.push({ email: { equals: input.email, mode: 'insensitive' } });
    }
    if (input.phone) {
      clauses.push({ phone: input.phone });
    }
    if (input.fullName && input.dateOfBirth) {
      clauses.push({
        fullName: { equals: input.fullName, mode: 'insensitive' },
        dateOfBirth: input.dateOfBirth,
      });
    }

    if (clauses.length === 0) {
      return [];
    }

    return this.prisma.student.findMany({
      where: { archivedAt: null, OR: clauses },
      orderBy: { createdAt: 'desc' },
    });
  }
}
