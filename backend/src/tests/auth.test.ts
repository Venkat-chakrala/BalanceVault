import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Authentication & Onboarding Tests', () => {
  const testEmail = `test_${Date.now()}@balancevault.com`;
  let authToken = '';

  afterAll(async () => {
    // Cleanup created test user (immutable AuditLog entries are preserved with actorId set null)
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
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

  it('should update profile details via PATCH /api/auth/profile', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fullName: 'Updated Automation User',
        phone: '+1-555-0199',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.fullName).toBe('Updated Automation User');
    expect(res.body.data.user.phone).toBe('+1-555-0199');
  });

  it('should reject self-assigning ADMIN role during public registration (forces USER)', async () => {
    const privEmail = `priv_${Date.now()}@balancevault.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: privEmail,
        password: 'Password123!',
        fullName: 'Privilege Test',
        role: 'ADMIN',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('USER');

    const created = await prisma.user.findUnique({ where: { email: privEmail } });
    if (created) {
      await prisma.account.deleteMany({ where: { userId: created.id } });
      await prisma.user.delete({ where: { id: created.id } });
    }
  });

  it('should terminate session on logout and reject subsequent requests with the logged-out JWT', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!',
      });

    const sessionToken = loginRes.body.data.token;
    expect(sessionToken).toBeDefined();

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const meAfterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(meAfterLogout.status).toBe(401);
    expect(meAfterLogout.body.error.code).toBe('TOKEN_REVOKED');
  });
});

