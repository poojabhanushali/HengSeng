import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../server.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;

beforeAll(async () => {
  app = createApp();
  // Register/login admin
  await request(app)
    .post('/api/v1/auth/register')
    .send({ username: 'badmin', email: 'badmin@test.local', password: 'password123', role: 'admin' })
    .catch(() => {});
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = res.body.accessToken || res.body.token || '';
});

describe('Authentication', () => {
  it('login returns token and user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.username).toBe('admin');
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('registers a new user', async () => {
    const ts = Date.now();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: `newuser${ts}`, email: `new${ts}@test.local`, password: 'password123', role: 'viewer' });
    expect(res.status).toBe(201);
  });
});

describe('Protected routes require auth', () => {
  it('agents/run without token -> 401', async () => {
    const res = await request(app).post('/api/v1/agents/run');
    expect(res.status).toBe(401);
  });

  it('agents/run with admin token -> 200', async () => {
    const res = await request(app)
      .post('/api/v1/agents/run')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  }, 180000);

  it('settings GET works with auth', async () => {
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('API contracts', () => {
  it('health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('assets list', async () => {
    const res = await request(app).get('/api/v1/assets');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(10);
  });

  it('asset prices', async () => {
    const res = await request(app).get('/api/v1/assets/0700.HK/prices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bars)).toBe(true);
    expect(res.body.bars.length).toBeGreaterThan(0);
  });

  it('predictions performance', async () => {
    const res = await request(app).get('/api/v1/predictions/performance');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  it('sources status', async () => {
    const res = await request(app).get('/api/v1/sources/status');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sources)).toBe(true);
  });
});

describe('Role-based access', () => {
  it('viewer cannot run agents (403)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'viewer', password: 'admin123' });
    const token = res.body.accessToken;
    const r = await request(app)
      .post('/api/v1/agents/run')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });
});
