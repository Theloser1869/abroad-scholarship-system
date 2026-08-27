import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createStudentWithCase } from './helpers/create-student-case';
import { uploadTestDocument } from './helpers/upload-document';
import { issueTestSession } from './helpers/issue-session';

/// 10-partners/01_PARTNER_CRM.md: Partner/PartnerProgram/PartnerDocument/
/// PartnerStudentLink/CommissionRule/CommissionTransaction. Commission kept fully
/// separate from Payment/Contract.value/ScholarshipApplication.awardAmount (Hard Rule);
/// CommissionTransaction FSM (PENDING→ELIGIBLE→CALCULATED→APPROVED→PAYABLE→PAID,
/// CANCELLED from any non-terminal state), Decimal-only money math, deterministic rule
/// precedence, Document-subsystem reuse for PartnerDocument, field-level `internalNotes`
/// redaction, and the strict "Consultant/Sales/Student-Parent get zero by default" RBAC
/// matrix this phase's own security section repeatedly calls out.
describe('Partners + Commission (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let managerToken: string;
  let financeToken: string;
  let consultantAToken: string;
  let consultantAId: string;
  let docSpecialistToken: string;
  let salesToken: string;
  let studentSelfToken: string;

  let partnerAId: string;
  let partnerProgramAId: string;
  let studentAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: directorToken } = await issueTestSession(prisma, 'demo.director'));
    ({ token: managerToken } = await issueTestSession(prisma, 'demo.manager'));
    ({ token: financeToken } = await issueTestSession(prisma, 'demo.finance'));
    ({ token: consultantAToken, userId: consultantAId } = await issueTestSession(prisma, 'demo.consultant.a'));
    ({ token: docSpecialistToken } = await issueTestSession(prisma, 'demo.docspecialist'));
    ({ token: salesToken } = await issueTestSession(prisma, 'demo.sales'));
    ({ token: studentSelfToken } = await issueTestSession(prisma, 'demo.student.self'));

    const partnerA = await prisma.partner.findUniqueOrThrow({ where: { partnerCode: 'PT-US-90001' } });
    partnerAId = partnerA.id;
    const partnerProgramA = await prisma.partnerProgram.findUniqueOrThrow({ where: { partnerProgramCode: 'PP-US-90001-01' } });
    partnerProgramAId = partnerProgramA.id;
    const studentA = await prisma.student.findUniqueOrThrow({ where: { studentCode: 'HS-2026-90001' } });
    studentAId = studentA.id;
  });

  const consultantCaseIds: string[] = [];

  async function createCaseForConsultant(): Promise<{ studentId: string; caseId: string }> {
    const { studentId, caseId } = await createStudentWithCase(app, salesToken);
    const res = await request(app.getHttpServer())
      .post(`/cases/${caseId}/members`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ userId: consultantAId, role: 'OWNER' });
    expect(res.status).toBe(201);
    consultantCaseIds.push(caseId);
    return { studentId, caseId };
  }

  afterAll(async () => {
    if (consultantCaseIds.length > 0) {
      await prisma.caseMember.deleteMany({ where: { userId: consultantAId, caseId: { in: consultantCaseIds } } });
    }
    await app.close();
  });

  async function createPartner(overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/partners')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: `E2E Partner ${randomUUID()}`, type: 'AGENCY', countryCode: 'GB', ...overrides });
    expect(res.status).toBe(201);
    return res.body;
  }

  // Phase 14 fix — CommissionTransactionsService.create now requires an ACTIVE
  // PartnerStudentLink between the transaction's partner and its source student (a real
  // financial-attribution integrity gap the Final Architect Review found: nothing
  // previously stopped attributing commission to a partner with no actual relationship to
  // the source student). Every commission-transaction test below must establish this link
  // first — that setup requirement is itself part of what's being tested.
  async function linkPartnerToStudent(partnerId: string, studentId: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post(`/partners/${partnerId}/student-links`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ studentId, linkType: 'Referral' });
    expect(res.status).toBe(201);
  }

  async function createSignedContractWithPayment(studentId: string, value = 1000, currency = 'USD'): Promise<{ contractId: string; paymentId: string }> {
    const createRes = await request(app.getHttpServer()).post('/contracts').set('Authorization', `Bearer ${financeToken}`).send({ studentId, value, currency });
    const contract = createRes.body;
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/submit`).set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});
    await request(app.getHttpServer()).post(`/contracts/${contract.id}/send`).set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer())
      .post(`/contracts/${contract.id}/sign`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ signedDocumentId: `doc-commission-e2e-${randomUUID()}` });
    const paymentRes = await request(app.getHttpServer())
      .post(`/contracts/${contract.id}/payments`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ installmentNo: 1, amount: value, currency, dueDate: '2026-12-01' });
    const paymentId = paymentRes.body.id;
    await request(app.getHttpServer())
      .post(`/payments/${paymentId}/record`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ amount: value, method: 'bank_transfer', reference: `E2E-REF-${randomUUID()}` });
    return { contractId: contract.id, paymentId };
  }

  /// Client Acceptance Remediation DEC-09 (2026-08-27) — minimal real Visa fixture for the
  /// Commission↔Visa direct-link tests below.
  async function createVisa(caseId: string): Promise<{ visaId: string }> {
    const res = await request(app.getHttpServer())
      .post(`/cases/${caseId}/visas`)
      .set('Authorization', `Bearer ${consultantAToken}`)
      .send({ countryCode: 'US', visaType: `F-1-${randomUUID()}` });
    expect(res.status).toBe(201);
    return { visaId: res.body.id };
  }

  // ---------------------------------------------------------------------------
  // Partner
  // ---------------------------------------------------------------------------
  describe('Partner — RBAC / duplicate / field redaction', () => {
    it('ED can create a Partner; a duplicate (name, country) is rejected', async () => {
      const name = `Duplicate Check Partner ${randomUUID()}`;
      const first = await request(app.getHttpServer()).post('/partners').set('Authorization', `Bearer ${directorToken}`).send({ name, type: 'AGENCY', countryCode: 'FR' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer()).post('/partners').set('Authorization', `Bearer ${directorToken}`).send({ name, type: 'AGENCY', countryCode: 'FR' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_PARTNER');
    });

    it('CONSULTANT holds view-only partner:view (client permission-matrix remediation, 2026-08-25 — sheet03 "Partner CRM": Tư vấn = "Xem")', async () => {
      const res = await request(app.getHttpServer()).get(`/partners/${partnerAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(200);
    });

    it('SALES_MARKETING has zero grant (403)', async () => {
      const res = await request(app.getHttpServer()).get('/partners').set('Authorization', `Bearer ${salesToken}`);
      expect(res.status).toBe(403);
    });

    it('STUDENT_PARENT has zero grant (403) — "Student/Parent không được xem commission" extended to the whole domain', async () => {
      const res = await request(app.getHttpServer()).get(`/partners/${partnerAId}`).set('Authorization', `Bearer ${studentSelfToken}`);
      expect(res.status).toBe(403);
    });

    it('DOCUMENT_SPECIALIST can view but internalNotes is redacted', async () => {
      const res = await request(app.getHttpServer()).get(`/partners/${partnerAId}`).set('Authorization', `Bearer ${docSpecialistToken}`);
      expect(res.status).toBe(200);
      expect(res.body.internalNotes).toBeNull();

      const asEd = await request(app.getHttpServer()).get(`/partners/${partnerAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(asEd.body.internalNotes).toBe('Staff-only partner relationship note.');
    });

    it('DOCUMENT_SPECIALIST cannot create a Partner (403) — view-only', async () => {
      const res = await request(app.getHttpServer()).post('/partners').set('Authorization', `Bearer ${docSpecialistToken}`).send({ name: 'Nope', type: 'AGENCY', countryCode: 'US' });
      expect(res.status).toBe(403);
    });

    it('archive sets status INACTIVE (no hard-delete) via a dedicated ARCHIVE-audited action', async () => {
      const partner = await createPartner();
      const res = await request(app.getHttpServer()).post(`/partners/${partner.id}/archive`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('INACTIVE');
      const stillThere = await request(app.getHttpServer()).get(`/partners/${partner.id}`).set('Authorization', `Bearer ${directorToken}`);
      expect(stillThere.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // PartnerProgram
  // ---------------------------------------------------------------------------
  describe('PartnerProgram — nested under Partner, duplicate check, optional Program FK', () => {
    it('creating under a partner works; a duplicate (name, degree, major, intake) is rejected', async () => {
      const partner = await createPartner();
      const name = `Fixture Program ${randomUUID()}`;
      const first = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/programs`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ name, degreeLevel: "Master's", major: 'Data Science' });
      expect(first.status).toBe(201);
      const dup = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/programs`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ name, degreeLevel: "Master's", major: 'Data Science' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_PARTNER_PROGRAM');
    });

    it('an invalid programId is rejected 404 — never a duplicate University/Program row created', async () => {
      const partner = await createPartner();
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/programs`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ name: 'Bad link', programId: randomUUID() });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROGRAM_NOT_FOUND');
    });

    it('the fixture PartnerProgram is linked to the real Program master row (no duplicate)', async () => {
      const res = await request(app.getHttpServer()).get(`/partner-programs/${partnerProgramAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.programId).not.toBeNull();
    });

    /// DEC-12 — list/detail embed a Partner summary + (when `programId` is set) a
    /// Program/University summary, so a standalone `/partner-programs/:id` page (no
    /// partner context in its own URL) can still show "partner, university/program"
    /// without a per-row N+1 fetch (mirrors DEC-09/10/11).
    it('list and detail embed the Partner + Program/University summary (DEC-12)', async () => {
      const listRes = await request(app.getHttpServer()).get(`/partners/${partnerAId}/programs`).query({ limit: 50 }).set('Authorization', `Bearer ${directorToken}`);
      expect(listRes.status).toBe(200);
      const row = listRes.body.data.find((p: { id: string }) => p.id === partnerProgramAId);
      expect(row.partner).toEqual({ id: partnerAId, name: expect.any(String), countryCode: expect.any(String) });
      expect(row.program).toEqual(expect.objectContaining({ id: expect.any(String), degreeLevel: expect.any(String), major: expect.any(String) }));
      expect(row.program.university).toEqual({ id: expect.any(String), officialName: expect.any(String), countryCode: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/partner-programs/${partnerProgramAId}`).set('Authorization', `Bearer ${directorToken}`);
      expect(detailRes.body.partner.id).toBe(partnerAId);
      expect(detailRes.body.program.university.officialName).toEqual(expect.any(String));
    });

    it('CONSULTANT has zero grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/partner-programs/${partnerProgramAId}`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });

    /// REQ-ID-004/REQ-PARTNER-005 (Client Acceptance Remediation, 2026-08-27) — regression
    /// for the `nextPartnerProgramSuffix` prefix bug: it used to emit the parent Partner's
    /// own `PT-CC-NNNNN` code verbatim (`PT-...-NN`) instead of substituting `PP`.
    describe('business ID prefix (REQ-ID-004 regression — PT vs PP)', () => {
      it("generates PP-CC-NNNNN-NN, never the parent's PT- prefix, preserving the CC-NNNNN segment", async () => {
        const partner = await createPartner();
        expect(partner.partnerCode).toMatch(/^PT-[A-Z]{2}-\d{5}$/);
        const parentSuffix = partner.partnerCode.slice('PT-'.length); // "CC-NNNNN"

        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/programs`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ name: `Prefix regression ${randomUUID()}` });
        expect(res.status).toBe(201);
        expect(res.body.partnerProgramCode).toBe(`PP-${parentSuffix}-01`);
        expect(res.body.partnerProgramCode.startsWith('PT-')).toBe(false);
      });

      it('sequential generation still increments per-partner, and uniqueness still holds', async () => {
        const partner = await createPartner();
        const first = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/programs`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ name: `Sequential A ${randomUUID()}` });
        const second = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/programs`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ name: `Sequential B ${randomUUID()}` });
        expect(first.body.partnerProgramCode).toBe(`PP-${partner.partnerCode.slice(3)}-01`);
        expect(second.body.partnerProgramCode).toBe(`PP-${partner.partnerCode.slice(3)}-02`);
        expect(first.body.partnerProgramCode).not.toBe(second.body.partnerProgramCode);
      });

      it('a generated code is never accepted back as a client-suppliable override — immutable once created', async () => {
        const partner = await createPartner();
        // `partnerProgramCode` is not a field on CreatePartnerProgramDto, and the global
        // pipe runs `forbidNonWhitelisted: true` — the whole request is rejected 400
        // rather than silently stripping the extra field, so there is no way for a
        // client to influence the generated code at all.
        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/programs`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ name: `Immutability check ${randomUUID()}`, partnerProgramCode: 'PP-ZZ-99999-99' });
        expect(res.status).toBe(400);

        const retry = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/programs`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ name: `Immutability check retry ${randomUUID()}` });
        expect(retry.status).toBe(201);
        expect(retry.body.partnerProgramCode).not.toBe('PP-ZZ-99999-99');
        expect(retry.body.partnerProgramCode).toMatch(/^PP-[A-Z]{2}-\d{5}-\d{2}$/);
      });

      it('the pre-existing PP-US-90001-01 fixture record is untouched by the fix (no data rewrite)', async () => {
        const res = await request(app.getHttpServer()).get(`/partner-programs/${partnerProgramAId}`).set('Authorization', `Bearer ${directorToken}`);
        expect(res.status).toBe(200);
        expect(res.body.partnerProgramCode).toBe('PP-US-90001-01');
      });

      it("parent Partner IDs are unaffected — still PT-CC-NNNNN, never PP-", async () => {
        const partner = await createPartner();
        expect(partner.partnerCode).toMatch(/^PT-[A-Z]{2}-\d{5}$/);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // PartnerDocument
  // ---------------------------------------------------------------------------
  describe('PartnerDocument — Document subsystem reuse, immutable once ACTIVE, versioning', () => {
    async function uploadDocument(): Promise<string> {
      const res = await uploadTestDocument(app, directorToken, {
        ownerEntity: 'Partner',
        ownerId: partnerAId,
        documentType: 'MOU',
        title: `Fixture MOU ${randomUUID()}`,
      });
      expect(res.status).toBe(201);
      return res.body.id;
    }

    it('reuses the existing Document subsystem (real documentId FK) — no PartnerFile/PartnerStorage entity anywhere', async () => {
      const documentId = await uploadDocument();
      const partner = await createPartner();
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/documents`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ type: 'AGREEMENT', documentId });
      expect(res.status).toBe(201);
      expect(res.body.documentId).toBe(documentId);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.version).toBe(1);
    });

    it('activating supersedes the previous ACTIVE version; an ACTIVE row can no longer be PATCHed', async () => {
      const partner = await createPartner();
      const doc1 = await uploadDocument();
      const v1 = await request(app.getHttpServer()).post(`/partners/${partner.id}/documents`).set('Authorization', `Bearer ${directorToken}`).send({ type: 'MOU', documentId: doc1 });
      const activate1 = await request(app.getHttpServer()).post(`/partner-documents/${v1.body.id}/activate`).set('Authorization', `Bearer ${directorToken}`);
      expect(activate1.status).toBe(201);
      expect(activate1.body.status).toBe('ACTIVE');

      const editAttempt = await request(app.getHttpServer())
        .patch(`/partner-documents/${v1.body.id}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ effectiveDate: '2026-01-01' });
      expect(editAttempt.status).toBe(409);
      expect(editAttempt.body.error.code).toBe('PARTNER_DOCUMENT_NOT_EDITABLE');

      const doc2 = await uploadDocument();
      const v2 = await request(app.getHttpServer()).post(`/partners/${partner.id}/documents`).set('Authorization', `Bearer ${directorToken}`).send({ type: 'MOU', documentId: doc2 });
      expect(v2.body.version).toBe(2);
      const activate2 = await request(app.getHttpServer()).post(`/partner-documents/${v2.body.id}/activate`).set('Authorization', `Bearer ${directorToken}`);
      expect(activate2.status).toBe(201);

      const supersededCheck = await request(app.getHttpServer()).get(`/partner-documents/${v1.body.id}`).set('Authorization', `Bearer ${directorToken}`);
      expect(supersededCheck.body.status).toBe('SUPERSEDED');
    });

    it('archive is terminal (no hard-delete)', async () => {
      const partner = await createPartner();
      const doc = await uploadDocument();
      const created = await request(app.getHttpServer()).post(`/partners/${partner.id}/documents`).set('Authorization', `Bearer ${directorToken}`).send({ type: 'RATE_SHEET', documentId: doc });
      const archived = await request(app.getHttpServer()).post(`/partner-documents/${created.body.id}/archive`).set('Authorization', `Bearer ${directorToken}`);
      expect(archived.status).toBe(201);
      expect(archived.body.status).toBe('ARCHIVED');
    });

    it('SALES_MARKETING has zero grant (403); DOCUMENT_SPECIALIST can view', async () => {
      const denied = await request(app.getHttpServer()).get(`/partners/${partnerAId}/documents`).set('Authorization', `Bearer ${salesToken}`);
      expect(denied.status).toBe(403);
      const allowed = await request(app.getHttpServer()).get(`/partners/${partnerAId}/documents`).set('Authorization', `Bearer ${docSpecialistToken}`);
      expect(allowed.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // PartnerStudentLink
  // ---------------------------------------------------------------------------
  describe('PartnerStudentLink — junction table, duplicate check, archive frees a new link', () => {
    it('creates a link validating student/case ownership; a duplicate ACTIVE link is rejected', async () => {
      const { studentId, caseId } = await createCaseForConsultant();
      const partner = await createPartner();
      const first = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, caseId, linkType: 'Referral' });
      expect(first.status).toBe(201);

      const dup = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, caseId, linkType: 'Agent' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_PARTNER_STUDENT_LINK');
    });

    it('a Case belonging to a different student is rejected 404 — never mismatched FKs', async () => {
      const { caseId: otherCaseId } = await createCaseForConsultant();
      const partner = await createPartner();
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId: studentAId, caseId: otherCaseId, linkType: 'Referral' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CASE_NOT_FOUND');
    });

    /// Client Acceptance Remediation GAP-006 (HIGH, REQ-PARTNER-008) — same
    /// validate-against-the-real-owning-table pattern as caseId/applicationId above.
    describe('contractId (GAP-006)', () => {
      it('creates a link with a real contractId belonging to the same student', async () => {
        const { studentId } = await createCaseForConsultant();
        const partner = await createPartner();
        const { contractId } = await createSignedContractWithPayment(studentId);

        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/student-links`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ studentId, contractId, linkType: 'Referral' });
        expect(res.status).toBe(201);
        expect(res.body.contractId).toBe(contractId);
      });

      it('a Contract belonging to a different student is rejected 404 — never mismatched FKs', async () => {
        const { studentId: otherStudentId } = await createCaseForConsultant();
        const { contractId: otherStudentsContractId } = await createSignedContractWithPayment(otherStudentId);
        const partner = await createPartner();
        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/student-links`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ studentId: studentAId, contractId: otherStudentsContractId, linkType: 'Referral' });
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('CONTRACT_NOT_FOUND');
      });
    });

    it('archiving frees the (partner, student, case) combination for a new link', async () => {
      const { studentId, caseId } = await createCaseForConsultant();
      const partner = await createPartner();
      const created = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, caseId, linkType: 'Referral' });
      const archived = await request(app.getHttpServer()).post(`/partner-student-links/${created.body.id}/archive`).set('Authorization', `Bearer ${directorToken}`);
      expect(archived.status).toBe(201);
      expect(archived.body.status).toBe('ARCHIVED');

      const recreated = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, caseId, linkType: 'Referral' });
      expect(recreated.status).toBe(201);
    });

    it('visible from the student side too — GET /students/:id/partner-links', async () => {
      const res = await request(app.getHttpServer()).get(`/students/${studentAId}/partner-links`).set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    /// DEC-12 — both list contexts embed the OTHER side's summary (Partner-side list needs
    /// the Student's name; Student-side list needs the Partner's name), plus detail, so
    /// neither view needs a per-row N+1 fetch (mirrors DEC-09/10/11).
    it('both list contexts + detail embed the Partner + Student summary (DEC-12)', async () => {
      const { studentId, caseId } = await createCaseForConsultant();
      const partner = await createPartner();
      const created = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, caseId, linkType: 'Referral' });
      expect(created.status).toBe(201);

      const fromPartner = await request(app.getHttpServer()).get(`/partners/${partner.id}/student-links`).set('Authorization', `Bearer ${directorToken}`);
      const partnerRow = fromPartner.body.data.find((l: { id: string }) => l.id === created.body.id);
      expect(partnerRow.student).toEqual({ id: studentId, studentCode: expect.any(String), fullName: expect.any(String) });
      expect(partnerRow.partner).toEqual({ id: partner.id, name: partner.name, countryCode: expect.any(String) });

      const fromStudent = await request(app.getHttpServer()).get(`/students/${studentId}/partner-links`).set('Authorization', `Bearer ${directorToken}`);
      const studentRow = fromStudent.body.data.find((l: { id: string }) => l.id === created.body.id);
      expect(studentRow.partner).toEqual({ id: partner.id, name: partner.name, countryCode: expect.any(String) });

      const detailRes = await request(app.getHttpServer()).get(`/partner-student-links/${created.body.id}`).set('Authorization', `Bearer ${directorToken}`);
      expect(detailRes.body.partner.id).toBe(partner.id);
      expect(detailRes.body.student.id).toBe(studentId);
    });

    it('ADMIN_FINANCE can view but not create (403) — view-only on relationship data', async () => {
      const viewRes = await request(app.getHttpServer()).get(`/partners/${partnerAId}/student-links`).set('Authorization', `Bearer ${financeToken}`);
      expect(viewRes.status).toBe(200);
      const createRes = await request(app.getHttpServer())
        .post(`/partners/${partnerAId}/student-links`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId: studentAId, linkType: 'Referral' });
      expect(createRes.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // CommissionRule
  // ---------------------------------------------------------------------------
  describe('CommissionRule — basis validation, deterministic precedence', () => {
    it('FIXED basis requires fixedAmount and rejects percentageRate', async () => {
      const partner = await createPartner();
      const missing = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe('FIXED_AMOUNT_REQUIRED');

      const both = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 100, percentageRate: 0.1 });
      expect(both.status).toBe(400);
      expect(both.body.error.code).toBe('PERCENTAGE_RATE_NOT_ALLOWED');
    });

    it('CONTRACT_VALUE basis requires percentageRate and rejects fixedAmount', async () => {
      const partner = await createPartner();
      const missing = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'CONTRACT_VALUE', currency: 'USD' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe('PERCENTAGE_RATE_REQUIRED');
    });

    it('negative rate/amount is rejected 400', async () => {
      const partner = await createPartner();
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: -50 });
      expect(res.status).toBe(400);
    });

    it('zero amount is allowed (a legitimate promotional/no-commission rule)', async () => {
      const partner = await createPartner();
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 0 });
      expect(res.status).toBe(201);
    });

    it('a program-specific rule takes precedence over a partner-wide rule with lower priority', async () => {
      const partner = await createPartner();
      const programRes = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/programs`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ name: `Precedence Program ${randomUUID()}` });
      const partnerProgramId = programRes.body.id;

      const wide = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 50, priority: 100 });
      const specific = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 75, partnerProgramId, priority: 0 });
      expect(wide.status).toBe(201);
      expect(specific.status).toBe(201);

      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const txn = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId, partnerProgramId });
      expect(txn.status).toBe(201);
      expect(txn.body.commissionRuleId).toBe(specific.body.id);
    });

    it('deactivate then reactivate via dedicated actions', async () => {
      const partner = await createPartner();
      const rule = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const deactivated = await request(app.getHttpServer()).post(`/commission-rules/${rule.body.id}/deactivate`).set('Authorization', `Bearer ${directorToken}`);
      expect(deactivated.body.status).toBe('INACTIVE');
      const reactivated = await request(app.getHttpServer()).post(`/commission-rules/${rule.body.id}/activate`).set('Authorization', `Bearer ${directorToken}`);
      expect(reactivated.body.status).toBe('ACTIVE');
    });

    it('CONSULTANT has zero grant (403)', async () => {
      const res = await request(app.getHttpServer()).get(`/partners/${partnerAId}/commission-rules`).set('Authorization', `Bearer ${consultantAToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // CommissionTransaction — full lifecycle, financial precision, idempotency
  // ---------------------------------------------------------------------------
  describe('CommissionTransaction — FSM, Decimal precision, currency mismatch, idempotency', () => {
    // Phase 14 fix regression — Final Architect Review finding: nothing previously
    // verified the transaction's source student actually has a real relationship to the
    // partner it attributes commission to. A finance actor (fully authorized to call this
    // endpoint) must not be able to attribute commission to a partner uninvolved with the
    // source student/case.
    it('rejects attributing commission to a partner with no active PartnerStudentLink to the source student', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      // Deliberately no linkPartnerToStudent() call here — this partner has zero
      // relationship to this student.
      const { contractId } = await createSignedContractWithPayment(studentId);

      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PARTNER_STUDENT_LINK_REQUIRED');

      const count = await prisma.commissionTransaction.count({ where: { partnerId: partner.id } });
      expect(count).toBe(0);
    });

    it('an ARCHIVED (not ACTIVE) PartnerStudentLink does not satisfy the attribution check', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      const linkRes = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/student-links`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ studentId, linkType: 'Referral' });
      await request(app.getHttpServer()).post(`/partner-student-links/${linkRes.body.id}/archive`).set('Authorization', `Bearer ${directorToken}`);
      const { contractId } = await createSignedContractWithPayment(studentId);

      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PARTNER_STUDENT_LINK_REQUIRED');
    });

    it('full lifecycle: PENDING -> ELIGIBLE -> CALCULATED -> APPROVED -> PAYABLE -> PAID, with correct Decimal rounding', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'CONTRACT_VALUE', currency: 'USD', percentageRate: 0.1055 });

      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId, 1234.56);

      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(create.status).toBe(201);
      expect(create.body.status).toBe('PENDING');
      const id = create.body.id;

      const eligible = await request(app.getHttpServer()).post(`/commission-transactions/${id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
      expect(eligible.body.status).toBe('ELIGIBLE');

      const calculated = await request(app.getHttpServer()).post(`/commission-transactions/${id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      expect(calculated.status).toBe(201);
      expect(calculated.body.status).toBe('CALCULATED');
      // 1234.56 * 0.1055 = 130.24608 -> rounds to 130.25 (ROUND_HALF_UP, 2dp, Decimal-only).
      expect(calculated.body.calculatedAmount).toBe('130.25');

      const approved = await request(app.getHttpServer()).post(`/commission-transactions/${id}/approve`).set('Authorization', `Bearer ${financeToken}`);
      expect(approved.body.status).toBe('APPROVED');
      const payable = await request(app.getHttpServer()).post(`/commission-transactions/${id}/mark-payable`).set('Authorization', `Bearer ${financeToken}`);
      expect(payable.body.status).toBe('PAYABLE');
      const paid = await request(app.getHttpServer())
        .post(`/commission-transactions/${id}/pay`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ paymentReference: `SETTLE-${randomUUID()}` });
      expect(paid.status).toBe(201);
      expect(paid.body.status).toBe('PAID');
      expect(paid.body.paidAt).not.toBeNull();

      // Terminal — no direct edit after PAID.
      const editAttempt = await request(app.getHttpServer())
        .patch(`/commission-transactions/${id}`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ studentId });
      expect(editAttempt.status).toBe(409);
      expect(editAttempt.body.error.code).toBe('COMMISSION_TRANSACTION_NOT_EDITABLE');

      const cancelAttempt = await request(app.getHttpServer())
        .post(`/commission-transactions/${id}/cancel`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'test' });
      expect(cancelAttempt.status).toBe(409);
      expect(cancelAttempt.body.error.code).toBe('COMMISSION_TRANSACTION_CLOSED');
    });

    /// Client Acceptance Remediation DEC-09 (2026-08-27) — the Visa leg of GAP-006/
    /// REQ-PARTNER-008: "bắt buộc liên kết trực tiếp Hoa hồng ↔ Visa đối với các khoản hoa
    /// hồng phát sinh từ Visa. Không bắt buộc đối với các khoản hoa hồng không có nguồn từ
    /// Visa." `visaId` is auto-resolved by `resolveSource()`, the same mechanism already
    /// proven for `contractId` above — never a separate conditional-validation layer.
    describe('Visa leg (DEC-09) — sourceType=Visa auto-resolves visaId', () => {
      it('creating with sourceType=Visa resolves studentId/caseId/visaId from the real Visa row', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 50 });
        const { studentId, caseId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { visaId } = await createVisa(caseId);

        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Visa', sourceId: visaId });
        expect(res.status).toBe(201);
        expect(res.body.visaId).toBe(visaId);
        expect(res.body.studentId).toBe(studentId);
        expect(res.body.caseId).toBe(caseId);
        expect(res.body.contractId).toBeNull();
      });

      it('an unknown Visa id is rejected (404 VISA_NOT_FOUND)', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 50 });
        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Visa', sourceId: randomUUID() });
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('VISA_NOT_FOUND');
      });

      it('Contract/Payment-sourced transactions still have visaId: null — no regression', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 50 });
        const { studentId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { contractId } = await createSignedContractWithPayment(studentId);

        const res = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Contract', sourceId: contractId });
        expect(res.status).toBe(201);
        expect(res.body.visaId).toBeNull();
      });

      it('a FIXED-basis Visa-sourced transaction calculates successfully', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 75 });
        const { studentId, caseId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { visaId } = await createVisa(caseId);

        const create = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Visa', sourceId: visaId });
        await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
        const calculated = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
        expect(calculated.status).toBe(201);
        expect(calculated.body.status).toBe('CALCULATED');
        expect(calculated.body.calculatedAmount).toBe('75');
      });

      it('a percentage-basis Visa-sourced transaction fails calculate() with a clear error, not a misleading PAYMENT_NOT_FOUND', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'CONTRACT_VALUE', currency: 'USD', percentageRate: 0.1 });
        const { studentId, caseId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { visaId } = await createVisa(caseId);

        const create = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Visa', sourceId: visaId });
        await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
        const calculated = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
        expect(calculated.status).toBe(400);
        expect(calculated.body.error.code).toBe('COMMISSION_BASIS_MUST_BE_FIXED_FOR_VISA');
      });
    });

    it('an illegal jump (e.g. straight to calculate from PENDING) is rejected 409', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      const res = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_COMMISSION_TRANSACTION_STATE');
    });

    it('cancel is reachable from a non-terminal state with a required reason', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      const cancelled = await request(app.getHttpServer())
        .post(`/commission-transactions/${create.body.id}/cancel`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Deal fell through' });
      expect(cancelled.status).toBe(201);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.reason).toBe('Deal fell through');
    });

    it('duplicate creation for the same (source, rule) is rejected — idempotency against retry', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const first = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(first.status).toBe(201);
      const retry = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(retry.status).toBe(409);
      expect(retry.body.error.code).toBe('DUPLICATE_COMMISSION_TRANSACTION');
    });

    it('re-calculating twice while ELIGIBLE is a safe no-op recompute, not an accumulation', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 42.5 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
      const first = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      const second = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      expect(second.status).toBe(409); // ELIGIBLE-only; already CALCULATED after the first call.
      expect(first.body.calculatedAmount).toBe('42.5');
    });

    it('currency mismatch between the rule and the source Payment is rejected 409', async () => {
      const partner = await createPartner();
      const rule = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'PAYMENT_COLLECTED', currency: 'EUR', percentageRate: 0.1 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { paymentId } = await createSignedContractWithPayment(studentId, 500, 'USD');
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Payment', sourceId: paymentId, commissionRuleId: rule.body.id });
      expect(create.status).toBe(201);
      await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
      const res = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CURRENCY_MISMATCH');
    });

    it('PAYMENT_COLLECTED basis reads the actual collected Payment amount — never a duplicate outstanding/paid calculation', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'PAYMENT_COLLECTED', currency: 'USD', percentageRate: 0.2 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { paymentId } = await createSignedContractWithPayment(studentId, 300, 'USD');
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Payment', sourceId: paymentId });
      await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/confirm-eligibility`).set('Authorization', `Bearer ${financeToken}`);
      const calculated = await request(app.getHttpServer()).post(`/commission-transactions/${create.body.id}/calculate`).set('Authorization', `Bearer ${financeToken}`);
      expect(calculated.body.basisAmount).toBe('300');
      expect(calculated.body.calculatedAmount).toBe('60');
    });

    it('no CommissionRule matches -> 404 COMMISSION_RULE_NOT_FOUND, never a silent zero-amount transaction', async () => {
      const partner = await createPartner();
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const res = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COMMISSION_RULE_NOT_FOUND');
    });

    /// DEC-12 — list (both the bare global list and the partner-nested list) and detail
    /// embed a Partner summary + (nullable-safe) Student summary, so a row can show
    /// "partner, student/case/application reference" without a per-row N+1 fetch (mirrors
    /// DEC-09/10/11).
    it('list (global + partner-nested) and detail embed the Partner + Student summary (DEC-12)', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 10 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });
      expect(create.status).toBe(201);

      const globalList = await request(app.getHttpServer()).get('/commission-transactions').query({ partnerId: partner.id }).set('Authorization', `Bearer ${financeToken}`);
      const globalRow = globalList.body.data.find((t: { id: string }) => t.id === create.body.id);
      expect(globalRow.partner).toEqual({ id: partner.id, name: partner.name, countryCode: expect.any(String) });
      expect(globalRow.student).toEqual({ id: studentId, studentCode: expect.any(String), fullName: expect.any(String) });

      const nestedList = await request(app.getHttpServer()).get(`/partners/${partner.id}/commission-transactions`).set('Authorization', `Bearer ${financeToken}`);
      const nestedRow = nestedList.body.data.find((t: { id: string }) => t.id === create.body.id);
      expect(nestedRow.partner.id).toBe(partner.id);

      const detailRes = await request(app.getHttpServer()).get(`/commission-transactions/${create.body.id}`).set('Authorization', `Bearer ${financeToken}`);
      expect(detailRes.body.partner.name).toBe(partner.name);
      expect(detailRes.body.student.id).toBe(studentId);
    });

    it('RBAC: ADMIN_FINANCE full access; CONSULTANT/SALES_MARKETING/STUDENT_PARENT zero (403)', async () => {
      const res = await request(app.getHttpServer()).get('/commission-transactions').set('Authorization', `Bearer ${financeToken}`);
      expect(res.status).toBe(200);
      for (const token of [consultantAToken, salesToken, studentSelfToken]) {
        const denied = await request(app.getHttpServer()).get('/commission-transactions').set('Authorization', `Bearer ${token}`);
        expect(denied.status).toBe(403);
      }
    });

    it('audit: VIEW is recorded on GET /commission-transactions/:id', async () => {
      const partner = await createPartner();
      await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 5 });
      const { studentId } = await createCaseForConsultant();
      await linkPartnerToStudent(partner.id, studentId);
      const { contractId } = await createSignedContractWithPayment(studentId);
      const create = await request(app.getHttpServer())
        .post(`/partners/${partner.id}/commission-transactions`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ sourceType: 'Contract', sourceId: contractId });

      await request(app.getHttpServer()).get(`/commission-transactions/${create.body.id}`).set('Authorization', `Bearer ${financeToken}`);
      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'VIEW', objectType: 'CommissionTransactions', objectId: create.body.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.result).toBe('SUCCESS');
    });

    /// Client Acceptance Remediation GAP-006 (HIGH, REQ-PARTNER-008) —
    /// 16_Contract_Partner_Link wants "which Contract earned this commission" directly
    /// joinable. `contractId` is auto-resolved at create() time regardless of which base
    /// (`sourceType`) the transaction actually uses.
    describe('contractId traceability (GAP-006)', () => {
      it('is set directly from the Contract when sourceType is Contract', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 5 });
        const { studentId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { contractId } = await createSignedContractWithPayment(studentId);

        const create = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Contract', sourceId: contractId });
        expect(create.status).toBe(201);
        expect(create.body.contractId).toBe(contractId);

        const persisted = await prisma.commissionTransaction.findUniqueOrThrow({ where: { id: create.body.id } });
        expect(persisted.contractId).toBe(contractId);
      });

      it('is resolved one hop via Payment.contractId when sourceType is Payment', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 5 });
        const { studentId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { contractId, paymentId } = await createSignedContractWithPayment(studentId);

        const create = await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Payment', sourceId: paymentId });
        expect(create.status).toBe(201);
        expect(create.body.contractId).toBe(contractId);
      });

      it('every CommissionTransaction sourced from this Contract is now directly queryable via commissionTransaction.findMany({ where: { contractId } })', async () => {
        const partner = await createPartner();
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-rules`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ basis: 'FIXED', currency: 'USD', fixedAmount: 5 });
        const { studentId } = await createCaseForConsultant();
        await linkPartnerToStudent(partner.id, studentId);
        const { contractId } = await createSignedContractWithPayment(studentId);
        await request(app.getHttpServer())
          .post(`/partners/${partner.id}/commission-transactions`)
          .set('Authorization', `Bearer ${financeToken}`)
          .send({ sourceType: 'Contract', sourceId: contractId });

        const forThisContract = await prisma.commissionTransaction.findMany({ where: { contractId } });
        expect(forThisContract.length).toBeGreaterThanOrEqual(1);
        expect(forThisContract.every((t) => t.partnerId === partner.id)).toBe(true);
      });
    });
  });
});
