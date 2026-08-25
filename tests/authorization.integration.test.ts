import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { db } from '../src/services/db.js';

/**
 * Integration tests for the authorization matrix (Phase 11): every route
 * that touches athlete/medical data must be scoped to the caller's
 * organization, and admin-only mutations must reject non-admin roles.
 * Runs against a real Postgres instance (the same one `npm run dev` uses)
 * via the real Express app and the real register/login endpoints — not
 * mocks — so this exercises the actual auth + tenant-scoping code paths.
 */
describe('Authorization matrix', () => {
  let app: Express;
  const suffix = Date.now();

  let orgAAdminToken: string;
  let orgADoctorToken: string;
  let orgBAdminToken: string;
  let orgAAthleteId: string;

  beforeAll(async () => {
    app = await createApp();

    // Org A: self-registration always provisions an isolated org with the
    // registrant as ADMIN.
    const orgARegister = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `org-a-admin-${suffix}@test.local`,
        password: 'TestPassword123!',
        name: 'Org A Admin',
        organizationName: `Org A ${suffix}`,
      });
    expect(orgARegister.status).toBe(201);
    orgAAdminToken = orgARegister.body.data.token;
    const orgAId = orgARegister.body.data.user.organizationId;

    // Org B: a second, separate isolated org.
    const orgBRegister = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `org-b-admin-${suffix}@test.local`,
        password: 'TestPassword123!',
        name: 'Org B Admin',
        organizationName: `Org B ${suffix}`,
      });
    expect(orgBRegister.status).toBe(201);
    orgBAdminToken = orgBRegister.body.data.token;

    // A non-admin (DOCTOR) role/user within Org A, for the RBAC checks.
    // No invite flow exists yet, so this fixture is created directly.
    const doctorRole = await db.role.create({
      data: { name: 'DOCTOR', organizationId: orgAId, description: 'Read-only clinician' },
    });
    const bcrypt = await import('bcryptjs');
    await db.user.create({
      data: {
        email: `org-a-doctor-${suffix}@test.local`,
        password: await bcrypt.hash('TestPassword123!', 12),
        name: 'Org A Doctor',
        organizationId: orgAId,
        roleId: doctorRole.id,
      },
    });
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `org-a-doctor-${suffix}@test.local`, password: 'TestPassword123!' });
    expect(doctorLogin.status).toBe(200);
    orgADoctorToken = doctorLogin.body.data.token;

    // One athlete in Org A, created by its admin, for the cross-tenant checks.
    const createAthlete = await request(app)
      .post('/api/v1/athletes')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({ name: 'Test Athlete', dateOfBirth: '2000-01-01', gender: 'Male', nationality: 'USA', sport: 'Running' });
    expect(createAthlete.status).toBe(201);
    orgAAthleteId = createAthlete.body.data.athlete.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/athletes');
    expect(res.status).toBe(401);
    expect(res.body.requestId).toBeTruthy();
  });

  it('rejects a malformed/invalid token with 401', async () => {
    const res = await request(app).get('/api/v1/athletes').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it("lets an org's own admin see its own athlete", async () => {
    const res = await request(app)
      .get(`/api/v1/athletes/${orgAAthleteId}`)
      .set('Authorization', `Bearer ${orgAAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.athlete.id).toBe(orgAAthleteId);
  });

  it("blocks a different org's admin from reading another org's athlete (404, not leaked)", async () => {
    const res = await request(app)
      .get(`/api/v1/athletes/${orgAAthleteId}`)
      .set('Authorization', `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("excludes another org's athletes from the list endpoint (tenant isolation)", async () => {
    const res = await request(app).get('/api/v1/athletes').set('Authorization', `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.data.athletes ?? []).map((a: { id: string }) => a.id);
    expect(ids).not.toContain(orgAAthleteId);
  });

  it('blocks a non-admin (DOCTOR) role from an admin-only mutation with 403', async () => {
    const res = await request(app)
      .post('/api/v1/athletes')
      .set('Authorization', `Bearer ${orgADoctorToken}`)
      .send({ name: 'Should Not Be Created', dateOfBirth: '2000-01-01', gender: 'Male', nationality: 'USA', sport: 'Running' });
    expect(res.status).toBe(403);
  });

  it('allows a non-admin (DOCTOR) role to read within its own org', async () => {
    const res = await request(app)
      .get(`/api/v1/athletes/${orgAAthleteId}`)
      .set('Authorization', `Bearer ${orgADoctorToken}`);
    expect(res.status).toBe(200);
  });

  it('allows the admin role to perform the admin-only mutation', async () => {
    const res = await request(app)
      .post('/api/v1/athletes')
      .set('Authorization', `Bearer ${orgAAdminToken}`)
      .send({ name: 'Admin Created Athlete', dateOfBirth: '2000-01-01', gender: 'Female', nationality: 'USA', sport: 'Swimming' });
    expect(res.status).toBe(201);
  });
});
