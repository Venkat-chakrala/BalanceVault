import request from 'supertest';
import app from '../app';

describe('Role-Based Access Control (RBAC) Tests', () => {
  let userToken = '';
  let auditorToken = '';
  let adminToken = '';

  beforeAll(async () => {
    // 1. Login as regular user Alice
    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@balancevault.com', password: 'AlicePassword@123' });
    userToken = userRes.body.data.token;

    // 2. Login as Auditor
    const auditorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auditor@balancevault.com', password: 'AuditorPassword@123' });
    auditorToken = auditorRes.body.data.token;

    // 3. Login as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@balancevault.com', password: 'AdminPassword@123' });
    adminToken = adminRes.body.data.token;
  });

  it('should block regular USER from accessing admin user list (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should block regular USER from accessing audit trail (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/admin/audit-trail')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should allow AUDITOR to access audit trail and ledger verification', async () => {
    const res = await request(app)
      .get('/api/admin/ledger/verify')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isValid).toBe(true);
  });

  it('should block AUDITOR from modifying user accounts (admin-only route)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/fake-user-id')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ status: 'SUSPENDED' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should allow ADMIN full access to user management and system metrics', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThan(0);
  });
});

