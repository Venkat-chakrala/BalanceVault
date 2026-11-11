import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Input Validation & Boundary Defense Tests', () => {
  let aliceToken = '';
  let aliceAccountId = '';
  let bobAccountId = '';

  beforeAll(async () => {
    const aliceRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@balancevault.com', password: 'AlicePassword@123' });
    aliceToken = aliceRes.body.data.token;
    aliceAccountId = aliceRes.body.data.accounts[0].id;

    const bob = await prisma.user.findUnique({
      where: { email: 'bob@balancevault.com' },
      include: { accounts: true },
    });
    bobAccountId = bob!.accounts[0].id;
  });

  it('should reject negative transfer amounts with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: bobAccountId,
        amount: -5000,
        description: 'Negative exploit payload',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject zero transfer amount with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: bobAccountId,
        amount: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject self-transfers (fromAccount == toAccount) with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: aliceAccountId,
        amount: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-integer / floating-point cents with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: bobAccountId,
        amount: 12.345, // Non-integer
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should prevent duplicate transactions when an identical Idempotency-Key is submitted twice', async () => {
    const bob = await prisma.user.findUnique({
      where: { email: 'bob@balancevault.com' },
      include: { accounts: true },
    });
    const bobAccountNumber = bob!.accounts[0].accountNumber;
    const idemKey = `test-idem-${Date.now()}`;

    const firstRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: bobAccountNumber,
        amount: 100,
        description: 'Account number lookup + idempotency check',
      });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    const secondRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        fromAccountId: aliceAccountId,
        toAccountId: bobAccountNumber,
        amount: 100,
        description: 'Account number lookup + idempotency check',
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.error.code).toBe('DUPLICATE_TRANSACTION');
  });
});

