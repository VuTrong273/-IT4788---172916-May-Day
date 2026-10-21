import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { SignJWT } from 'jose';
import { AppModule } from './../src/app.module.js';
import { UserRepository } from './../src/auth/user.repository.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let findEndpointAccess: ReturnType<typeof vi.fn>;
  const previousSecret = process.env.JWT_SECRET;
  const secret = 'e2e-secret-with-at-least-thirty-two-characters';
  const profile = {
    user_id: 1,
    full_name: 'System Admin',
    phone: '0900000000',
    role_id: 1,
    gender: null,
    year_of_birth: null,
    career: null,
    ethnic: null,
    hamlet_address: null,
    commune_address: null,
    city_address: null,
    work_place: null,
    health_insurance_number: null,
    health_insurance_validate: null,
    next_of_kin_name: null,
    next_of_kin_phone: null,
    first_visit: null,
    branch_id: null,
    department_id: null,
    room_id: null,
  };

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  beforeEach(async () => {
    findEndpointAccess = vi.fn().mockResolvedValue({
      is_public: 0,
      is_allowed: true,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserRepository)
      .useValue({
        findAuthState: vi.fn().mockResolvedValue({
          role_id: 1,
          is_active: 1,
          password_changed_at: null,
          is_blacklisted: false,
        }),
        findProfile: vi.fn().mockResolvedValue(profile),
        findEndpointAccess,
        createPatient: vi.fn().mockResolvedValue({
          user_id: 2,
          full_name: 'Nguyễn Văn A',
          phone: '0912345678',
          gender: null,
          role_id: 3,
          is_active: 1,
          created_at: new Date('2026-10-21T00:00:00.000Z'),
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/auth/login rejects an invalid phone', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '123', password: 'Admin@123' })
      .expect(400)
      .expect({
        code: '2004',
        message: 'Invalid phone number format',
        data: {},
      });
  });

  it('/api/v1/auth/signup creates a patient without a token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'Nguyễn Văn A', phone: '0912345678', password: 'Abc@1234' })
      .expect(201)
      .expect({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: 2,
          full_name: 'Nguyễn Văn A',
          phone: '0912345678',
          role_id: 3,
          is_active: 1,
          created_at: '2026-10-21T00:00:00.000Z',
        },
      });
  });

  it('/api/v1/profile requires a token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/profile')
      .expect(401)
      .expect({ code: '3003', message: 'User not authenticated', data: {} });
  });

  it('/api/v1/profile returns the current user profile', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ code: '1000', message: 'OK', data: profile });
    expect(findEndpointAccess).toHaveBeenCalledWith(
      1,
      'GET',
      '/api/v1/profile',
    );
  });

  it('/api/v1/profile denies a role whose permission was revoked', async () => {
    findEndpointAccess.mockResolvedValue({ is_public: 0, is_allowed: false });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setJti('test-jti')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    return request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({ code: '3101', message: 'Permission denied', data: {} });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
});
