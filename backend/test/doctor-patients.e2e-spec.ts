import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import { UserRepository } from '../src/auth/user.repository.js';
import { DoctorPatientsRepository } from '../src/doctor-patients/doctor-patients.repository.js';

describe('Doctor patients API', () => {
  let app: INestApplication<App>;
  let token: string;
  let roleId: number;
  const previousSecret = process.env.JWT_SECRET;
  const secret = 'doctor-patients-e2e-secret-at-least-32-characters';
  const patients = { roleName: vi.fn(), search: vi.fn(), create: vi.fn() };
  const access = vi.fn();
  const patient = {
    user_id: 15,
    full_name: 'Test Patient',
    phone: '0912345678',
    gender: null,
    year_of_birth: 1995,
    created_at: '2026-10-27T00:00:00Z',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    token = await new SignJWT({ issued_at_ms: Date.now() })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('2')
      .setJti('doctor-patients-test')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue({
        findAuthState: vi
          .fn()
          .mockImplementation(() => ({
            role_id: roleId,
            is_active: 1,
            is_blacklisted: false,
            password_changed_at: null,
          })),
        findEndpointAccess: access,
      })
      .overrideProvider(DoctorPatientsRepository)
      .useValue(patients)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    roleId = 2;
    access.mockResolvedValue({ is_public: 0, is_allowed: true });
    patients.roleName.mockResolvedValue('doctor');
    patients.search.mockResolvedValue([patient]);
    patients.create.mockResolvedValue({ ...patient, role_id: 3 });
  });

  afterAll(async () => {
    await app.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/doctor/patients/search?phone=0912')
      .expect(401);
    expect(patients.search).not.toHaveBeenCalled();
  });

  it('checks endpoint permissions and returns search results', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/doctor/patients/search')
      .query({ phone: '0912', full_name: 'Test' })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual({
      code: '1000',
      message: 'OK',
      data: [patient],
    });
    expect(access).toHaveBeenCalledWith(
      2,
      'GET',
      '/api/v1/doctor/patients/search',
    );
    expect(patients.search).toHaveBeenCalledWith('0912', 'Test');
  });

  it('blocks users without endpoint permission', async () => {
    access.mockResolvedValue({ is_public: 0, is_allowed: false });
    await request(app.getHttpServer())
      .get('/api/v1/doctor/patients/search?phone=0912')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(patients.search).not.toHaveBeenCalled();
  });

  it('blocks a non-doctor even if endpoint access was granted', async () => {
    roleId = 3;
    patients.roleName.mockResolvedValue('patient');
    const response = await request(app.getHttpServer())
      .post('/api/v1/doctor/patients')
      .auth(token, { type: 'bearer' })
      .send({
        full_name: 'Test Patient',
        phone: '0912345678',
        password: 'Test@123',
      })
      .expect(403);
    expect(response.body.code).toBe('3103');
    expect(patients.create).not.toHaveBeenCalled();
  });

  it('creates a patient with a hashed password and HTTP 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/doctor/patients')
      .auth(token, { type: 'bearer' })
      .send({
        full_name: 'Test Patient',
        phone: '0912345678',
        password: 'Test@123',
        year_of_birth: 1995,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      code: '1001',
      data: { user_id: 15, role_id: 3 },
    });
    expect(patients.create.mock.calls[0][0].passwordHash).toMatch(/^\$2/);
    expect(response.body.data).not.toHaveProperty('password_hash');
    expect(access).toHaveBeenCalledWith(2, 'POST', '/api/v1/doctor/patients');
  });

  it('rejects empty searches', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/doctor/patients/search')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(response.body.code).toBe('2001');
  });
});
