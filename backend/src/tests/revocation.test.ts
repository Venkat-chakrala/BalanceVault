import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';

describe('Immediate Session Revocation Defense Tests', () => {
  let victimToken = '';
  let victimId = '';
  let adminToken = '';

  beforeAll(async () => {
    // 1. Create a fresh victim user
    const victimRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `victim_${Date.now()}@balancevault.com`,
        password: 'Password123!',
        fullName: 'Session Revocation Victim',
      });
    victimToken = victimRes.body.data.token;
    victimId = victimRes.body.data.user.id;

    // 2. Login as admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@balancevault.com', password: 'AdminPassword@123' });
    adminToken = adminRes.body.data.token;
  });

  afterAll(async () => {
    if (victimId) {
      await prisma.account.deleteMany({ where: { userId: victimId } });
      await prisma.user.delete({ where: { id: victimId } });
    }
  });

  it('should allow victim to query profile before suspension', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${victimToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should immediately revoke the active JWT when Admin suspends the user (Zero Stale Window)', async () => {
    // Admin suspends the victim
    const patchRes = await request(app)
      .patch(`/api/admin/users/${victimId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' });

    expect(patchRes.status).toBe(200);

    // Victim attempts to reuse their existing token on the very next request
    const postSuspensionRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${victimToken}`);

    // Must be rejected immediately!
    expect(postSuspensionRes.status).toBe(403);
    expect(postSuspensionRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

