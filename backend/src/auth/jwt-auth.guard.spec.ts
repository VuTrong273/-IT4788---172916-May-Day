import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SignJWT } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UserRepository } from './user.repository.js';

const SECRET = 'test-secret-with-at-least-thirty-two-characters';

describe('JwtAuthGuard', () => {
  const previousSecret = process.env.JWT_SECRET;
  let request: {
    headers: { authorization?: string };
    method: string;
    route: { path: string };
    user?: unknown;
  };
  let findAuthState: ReturnType<typeof vi.fn>;
  let findEndpointAccess: ReturnType<typeof vi.fn>;
  let getAllAndOverride: ReturnType<typeof vi.fn>;
  let guard: JwtAuthGuard;
  let context: ExecutionContext;

  async function token(options?: { expired?: boolean; subject?: string }) {
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(options?.subject ?? '7')
      .setJti('test-jti')
      .setIssuedAt();
    jwt.setExpirationTime(options?.expired ? '-1s' : '1h');
    return jwt.sign(new TextEncoder().encode(SECRET));
  }

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  beforeEach(() => {
    request = {
      headers: {},
      method: 'GET',
      route: { path: '/api/v1/profile' },
    };
    findAuthState = vi.fn().mockResolvedValue({
      role_id: 2,
      is_active: 1,
      password_changed_at: null,
      is_blacklisted: false,
    });
    findEndpointAccess = vi.fn().mockResolvedValue({
      is_public: 0,
      is_allowed: true,
    });
    getAllAndOverride = vi.fn().mockReturnValue(false);
    guard = new JwtAuthGuard(
      { getAllAndOverride } as unknown as Reflector,
      { findAuthState, findEndpointAccess } as unknown as UserRepository,
    );
    context = {
      getHandler: () => vi.fn(),
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('skips authentication for public routes', async () => {
    getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findAuthState).not.toHaveBeenCalled();
    expect(findEndpointAccess).not.toHaveBeenCalled();
  });

  it('rejects a missing token', async () => {
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: '3003' },
    });
  });

  it.each(['Basic abc', 'Bearer ', 'Bearer abc def', 'Bearer invalid'])
    ('rejects an invalid Authorization header: %s', async (authorization) => {
      request.headers.authorization = authorization;
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: 401,
        response: { code: '3001' },
      });
    });

  it('rejects an expired token', async () => {
    request.headers.authorization = `Bearer ${await token({ expired: true })}`;
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: '3002' },
    });
  });

  it('loads the user from the database and attaches it to the request', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findAuthState).toHaveBeenCalledWith(7, 'test-jti');
    expect(findEndpointAccess).toHaveBeenCalledWith(
      2,
      'GET',
      '/api/v1/profile',
    );
    expect(request.user).toMatchObject({ userId: 7, roleId: 2, jti: 'test-jti' });
  });

  it('rejects a role without permission for the endpoint', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findEndpointAccess.mockResolvedValue({ is_public: 0, is_allowed: false });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: '3101', message: 'Permission denied', data: {} },
    });
  });

  it('rejects an endpoint absent from RBAC configuration', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findEndpointAccess.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: '3101' },
    });
  });

  it('maps RBAC database failures to 9902', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findEndpointAccess.mockRejectedValue(new Error('private database details'));
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error', data: {} },
    });
  });

  it('rejects an unknown user', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findAuthState.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: '3001' },
    });
  });

  it('rejects a deactivated user', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findAuthState.mockResolvedValue({ is_active: 0 });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: '3010' },
    });
  });

  it('rejects a blacklisted token', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findAuthState.mockResolvedValue({ is_active: 1, is_blacklisted: true });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: '3001' },
    });
  });

  it('rejects a token issued before a password change', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findAuthState.mockResolvedValue({
      is_active: 1,
      is_blacklisted: false,
      password_changed_at: new Date(Date.now() + 10_000),
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: '3001' },
    });
  });

  it('maps database failures to 9902', async () => {
    request.headers.authorization = `Bearer ${await token()}`;
    findAuthState.mockRejectedValue(new Error('private database details'));
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error', data: {} },
    });
  });
});
