import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/// Student+Case are only ever created together via Lead conversion (04-core-crm/
/// 01_LEAD.md — there is no standalone `POST /cases` or `POST /students` that also makes
/// a Case). Phase 05 Contract fixtures need a real Student with a real active Case (Contract
/// creation requires an existing Student; `sign()` requires an active Case to link to) —
/// this walks the real production path instead of writing directly into the DB, so these
/// tests exercise the actual chain of custody.
export async function createStudentWithCase(app: INestApplication, salesToken: string): Promise<{ studentId: string; caseId: string }> {
  const unique = `${Date.now()}-${Math.random()}`;
  const leadRes = await request(app.getHttpServer())
    .post('/leads')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ contactName: `Commercial Fixture Contact ${unique}`, email: `commercial-fixture-${unique}@example.local` });
  const leadId = leadRes.body.id;

  for (const status of ['CONTACTED', 'QUALIFIED', 'CONSULTATION', 'CONTRACTING']) {
    await request(app.getHttpServer()).patch(`/leads/${leadId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status });
  }

  const convertRes = await request(app.getHttpServer()).post(`/leads/${leadId}/convert`).set('Authorization', `Bearer ${salesToken}`).send({});
  return { studentId: convertRes.body.student.id, caseId: convertRes.body.case.id };
}
