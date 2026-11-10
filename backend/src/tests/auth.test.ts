import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Authentication & Onboarding Tests', () => {
  const testEmail = `test_${Date.now()}@balancevault.com`;
  let authToken = '';

  afterAll(async () => {
    // Cleanup created test user
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should successfully register a new user with an initial checking account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test Automation User',
        initialDepositCents: 10000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.account.accountNumber).toMatch(/^BV-\d{6}$/);
    expect(res.body.data.token).toBeDefined();

    authToken = res.body.data.token;
  });

  it('should reject registration if email is already taken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        fullName: 'Duplicate User',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should successfully login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject login for a SUSPENDED user account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'charlie@balancevault.com',
        password: 'CharliePassword@123',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('suspended');
  });

  it('should allow authenticated user to retrieve their profile and accounts', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.accounts.length).toBeGreaterThanOrEqual(1);
  });
});
