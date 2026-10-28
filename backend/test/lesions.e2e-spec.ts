import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import request from 'supertest';
import { SignJWT } from 'jose';
import { Readable } from 'node:stream';
import { AppModule } from '../src/app.module.js';
import { UserRepository } from '../src/auth/user.repository.js';
import { LesionsRepository } from '../src/lesions/lesions.repository.js';
import { ObjectStorageService } from '../src/lesions/object-storage.service.js';
import { authorize } from '../src/lesions/lesions.validation.js';
import type { AuthenticatedUser } from '../src/auth/jwt-auth.guard.js';

describe('Private image HTTP API', () => {
  let app: INestApplication<App>;
  let token: string;
  const secret = 'lesions-http-test-secret-with-at-least-32-characters';
  const previous = process.env.JWT_SECRET;
  const query = vi.fn(),
    get = vi.fn(),
    put = vi.fn(),
    access = vi.fn();
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('15')
      .setJti('image-test')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue({
        findAuthState: async () => ({
          role_id: 3,
          is_active: 1,
          is_blacklisted: false,
          password_changed_at: null,
        }),
        findEndpointAccess: access,
      })
      .overrideProvider(LesionsRepository)
      .useValue({
        role: async () => 'patient',
        pool: { query },
        withRecord: async (
          user: AuthenticatedUser,
          _id: number,
          write: boolean,
          action: (client: unknown, record: unknown) => Promise<unknown>,
        ) => {
          const record = authorize(
            {
              medical_record_id: 1,
              patient_id: 15,
              assigned_doctor_id: 8,
              status: 'in_progress',
            },
            user.userId,
            'patient',
            write,
          );
          return action({ query }, record);
        },
      })
      .overrideProvider(ObjectStorageService)
      .useValue({ put, get, remove: vi.fn() })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    access.mockResolvedValue({ is_public: 0, is_allowed: true });
    query.mockResolvedValue({ rows: [{ id: '3' }] });
    get.mockResolvedValue(Readable.from(bytes));
  });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  it('requires authentication even for binary image downloads', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/image-attachments/3/content')
      .expect(401);
    expect(get).not.toHaveBeenCalled();
  });
  it('uploads multipart images and returns the private URL', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/image-attachments/upload')
      .auth(token, { type: 'bearer' })
      .field('medical_record_id', '1')
      .attach('file', bytes, { filename: 'test.png', contentType: 'image/png' })
      .expect(201);
    expect(response.body.data).toEqual({
      id: '3',
      file_url: '/image-attachments/3/content',
    });
    expect(put).toHaveBeenCalledOnce();
  });
  it('enforces file size before touching object storage', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/image-attachments/upload')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(response.body.code).toBe('6003');
    expect(put).not.toHaveBeenCalled();
  });
  it('enforces the 10-image batch limit', async () => {
    let call = request(app.getHttpServer())
      .post('/api/v1/image-attachments/upload-multiple')
      .auth(token, { type: 'bearer' });
    for (let i = 0; i < 11; i++)
      call = call.attach('images', bytes, {
        filename: `${i}.png`,
        contentType: 'image/png',
      });
    const response = await call.expect(400);
    expect(response.body.code).toBe('6004');
    expect(put).not.toHaveBeenCalled();
  });
  it('returns an authenticated binary response without public caching', async () => {
    query.mockResolvedValue({
      rows: [
        {
          user_id: 15,
          medical_record_id: 1,
          file_path: 'private',
          file_type: 'image/png',
          file_size: 8,
        },
      ],
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/image-attachments/3/content')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual(bytes);
    expect(access).toHaveBeenCalledWith(
      3,
      'GET',
      '/api/v1/image-attachments/:id/content',
    );
  });
});
