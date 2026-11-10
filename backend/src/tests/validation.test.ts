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
});
