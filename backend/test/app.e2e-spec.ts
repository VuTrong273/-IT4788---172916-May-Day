import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { SignJWT } from 'jose';
import { hash } from 'bcryptjs';
import { AppModule } from './../src/app.module.js';
import { UserRepository } from './../src/auth/user.repository.js';
import { MailService } from './../src/auth/mail.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let findEndpointAccess: ReturnType<typeof vi.fn>;
  let blacklistToken: ReturnType<typeof vi.fn>;
  let updateProfile: ReturnType<typeof vi.fn>;
  let changePassword: ReturnType<typeof vi.fn>;
  let passwordHash: string;
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

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    passwordHash = await hash('Admin@123', 4);
  });

  beforeEach(async () => {
    const blacklistedJtis = new Set<string>();
    blacklistToken = vi.fn().mockImplementation((_: number, jti: string) => {
      blacklistedJtis.add(jti);
    });
    changePassword = vi.fn().mockImplementation((_: number, __: string, ___: string, jti: string) => {
      blacklistedJtis.add(jti);
      return true;
    });
    findEndpointAccess = vi.fn().mockResolvedValue({
      is_public: 0,
      is_allowed: true,
    });
    updateProfile = vi.fn().mockImplementation((_: number, changes: { full_name?: string }) => ({
      ...profile,
      ...changes,
    }));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserRepository)
      .useValue({
        findAuthState: vi.fn().mockImplementation((_: number, jti: string) => ({
          role_id: 1,
          is_active: 1,
          password_changed_at: null,
          is_blacklisted: blacklistedJtis.has(jti),
        })),
        findProfile: vi.fn().mockResolvedValue(profile),
        updateProfile,
        findEndpointAccess,
        blacklistToken,
        findPasswordHash: vi.fn().mockImplementation(() => passwordHash),
        changePassword,
        findRecoveryTarget: vi.fn().mockResolvedValue(null),
        requestRecoveryEmail: vi.fn().mockResolvedValue(true),
        verifyRecoveryEmail: vi.fn().mockResolvedValue('success'),
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
      .overrideProvider(MailService)
      .useValue({ sendOtp: vi.fn().mockResolvedValue(undefined) })
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

  it('/api/v1/auth/forgot-password does not reveal unknown accounts or OTPs', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);
    expect(response.body).toEqual({
      code: '1000',
      message: 'If an email is registered, an OTP has been sent',
      data: { expires_in: 600 },
    });
  });

  it('/api/v1/auth/forgot-password requires email instead of phone', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ phone: '0912345678' })
      .expect(400)
      .expect({ code: '2001', message: 'Missing required parameter', data: {} });
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

  it('/api/v1/auth/logout revokes the token for later requests', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setJti('logout-jti')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ code: '1000', message: 'OK', data: {} });
    expect(blacklistToken).toHaveBeenCalledWith(
      1,
      'logout-jti',
      expect.any(Date),
    );
    expect(findEndpointAccess).toHaveBeenCalledWith(
      1,
      'POST',
      '/api/v1/auth/logout',
    );

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
      .expect({ code: '3001', message: 'Token is invalid', data: {} });
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('/api/v1/auth/change-password revokes the current token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setJti('change-jti')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    await request(app.getHttpServer())
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        old_password: 'Admin@123',
        new_password: 'New@12345',
        confirm_password: 'New@12345',
      })
      .expect(200)
      .expect({ code: '1000', message: 'OK', data: {} });
    expect(changePassword).toHaveBeenCalledWith(
      1,
      passwordHash,
      expect.any(String),
      'change-jti',
      expect.any(Date),
    );
    expect(findEndpointAccess).toHaveBeenCalledWith(
      1,
      'PUT',
      '/api/v1/auth/change-password',
    );

    await request(app.getHttpServer())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
      .expect({ code: '3001', message: 'Token is invalid', data: {} });
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

  it('/api/v1/profile updates only the authenticated user', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setJti('update-jti')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    await request(app.getHttpServer())
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Tên mới' })
      .expect(200)
      .expect({ code: '1000', message: 'OK', data: { ...profile, full_name: 'Tên mới' } });
    expect(updateProfile).toHaveBeenCalledWith(1, { full_name: 'Tên mới' });
    expect(findEndpointAccess).toHaveBeenCalledWith(1, 'PUT', '/api/v1/profile');
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
