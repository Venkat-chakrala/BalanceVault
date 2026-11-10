import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Concurrency & Anti-Double-Spend Defense Tests', () => {
  let userToken = '';
  let sourceAccountId = '';
  let destAccountId = '';
  let testUserId = '';

  beforeAll(async () => {
    // 1. Create a dedicated user with an exact balance of $100.00 (10,000 cents)
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `concurrency_${Date.now()}@balancevault.com`,
        password: 'Password123!',
        fullName: 'Race Condition Tester',
        initialDepositCents: 10000, // Exactly $100.00
      });

    userToken = userRes.body.data.token;
    testUserId = userRes.body.data.user.id;
    sourceAccountId = userRes.body.data.account.id;

    // Get Bob's account as destination
    const bob = await prisma.user.findUnique({
      where: { email: 'bob@balancevault.com' },
      include: { accounts: true },
    });
    destAccountId = bob!.accounts[0].id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.auditLog.deleteMany({ where: { actorId: testUserId } });
      await prisma.ledgerEntry.deleteMany({ where: { accountId: sourceAccountId } });
      await prisma.transaction.deleteMany({ where: { initiatedById: testUserId } });
      await prisma.account.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
  });

  it('should prevent double-spending when 5 simultaneous transfer requests of $80 are fired with a $100 balance', async () => {
    // Firing 5 concurrent transfers of $80.00 (8000 cents).
    // Total attempted: $400.00 against an available balance of $100.00.
    // Under strict concurrency control, EXACTLY ONE transfer can succeed, and FOUR must fail!
    const transferPayload = {
      fromAccountId: sourceAccountId,
      toAccountId: destAccountId,
      amount: 8000,
      description: 'Concurrent race condition attack payload',
    };

    const requests = [1, 2, 3, 4, 5].map(() =>
      request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferPayload)
    );

    const responses = await Promise.all(requests);

    const successfulTransfers = responses.filter((r) => r.status === 200);
    const rejectedTransfers = responses.filter((r) => r.status >= 400);

    // Exactly 1 must succeed
    expect(successfulTransfers.length).toBe(1);
    // Exactly 4 must be rejected
    expect(rejectedTransfers.length).toBe(4);

    // Verify source account balance in DB is exactly $20.00 (2000 cents) and NOT negative!
    const updatedSource = await prisma.account.findUnique({
      where: { id: sourceAccountId },
    });

    expect(updatedSource?.cachedBalance).toBe(2000);
    expect(updatedSource?.cachedBalance).toBeGreaterThanOrEqual(0);
  });
});
