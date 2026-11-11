import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Insecure Direct Object Reference (IDOR) Defense Tests', () => {
  let aliceToken = '';
  let bobToken = '';
  let aliceAccountId = '';
  let bobAccountId = '';

  beforeAll(async () => {
    // Login as Alice
    const aliceRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@balancevault.com', password: 'AlicePassword@123' });
    aliceToken = aliceRes.body.data.token;
    aliceAccountId = aliceRes.body.data.accounts[0].id;

    // Login as Bob
    const bobRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@balancevault.com', password: 'BobPassword@123' });
    bobToken = bobRes.body.data.token;
    bobAccountId = bobRes.body.data.accounts[0].id;
  });

  it('should block Bob from viewing Alice account balance via IDOR (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/accounts/${aliceAccountId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should block Bob from inspecting Alice transaction history via IDOR (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/accounts/${aliceAccountId}/transactions`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should block Bob from transferring money OUT of Alice account (IDOR transfer attack)', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        fromAccountId: aliceAccountId, // Bob claims Alice's account as source
        toAccountId: bobAccountId,
        amount: 5000,
        description: 'IDOR exploit attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Unauthorized');
  });

  it('should block Bob from depositing into Alice account via IDOR (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/transfers/deposit')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        accountId: aliceAccountId,
        amount: 1000,
        description: 'Unauthorized deposit test',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should verify that an unauthorized IDOR attempt was recorded in the audit trail', async () => {
    const auditRecord = await prisma.auditLog.findFirst({
      where: { action: 'UNAUTHORIZED_TRANSFER_ATTEMPT' },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord?.severity).toBe('SECURITY_ALERT');
  });
});

