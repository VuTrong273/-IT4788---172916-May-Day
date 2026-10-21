import { HttpException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { jwtVerify } from 'jose';
import { AuthService } from './auth.service.js';
import { LoginUser, UserRepository } from './user.repository.js';

const SECRET = 'test-secret-with-at-least-thirty-two-characters';
const USER: LoginUser = {
  user_id: 1,
  full_name: 'System Admin',
  phone: '0900000000',
  password_hash: '',
  role_id: 1,
  is_active: 1,
};

describe('AuthService', () => {
  const previousSecret = process.env.JWT_SECRET;
  let findByPhone: ReturnType<typeof vi.fn>;
  let createPatient: ReturnType<typeof vi.fn>;
  let service: AuthService;

  beforeAll(async () => {
    USER.password_hash = await hash('Admin@123', 4);
    process.env.JWT_SECRET = SECRET;
  });

  beforeEach(() => {
    findByPhone = vi.fn().mockResolvedValue(USER);
    createPatient = vi.fn().mockResolvedValue({
      user_id: 2,
      full_name: 'Nguyễn Văn A',
      phone: '0912345678',
      gender: null,
      role_id: 3,
      is_active: 1,
      created_at: new Date('2026-10-21T00:00:00.000Z'),
    });
    service = new AuthService({ findByPhone, createPatient } as unknown as UserRepository);
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('returns a signed JWT and public user info', async () => {
    const result = await service.login({
      phone: '0900000000',
      password: 'Admin@123',
    });

    expect(findByPhone).toHaveBeenCalledWith('0900000000');
    expect(result).toMatchObject({
      code: '1000',
      message: 'OK',
      data: {
        user_info: {
          user_id: 1,
          full_name: 'System Admin',
          phone: '0900000000',
          role_id: 1,
        },
      },
    });
    expect(result.data.user_info).not.toHaveProperty('password_hash');
    const { payload } = await jwtVerify(
      result.data.token,
      new TextEncoder().encode(SECRET),
      { algorithms: ['HS256'] },
    );
    expect(payload.sub).toBe('1');
    expect(payload.jti).toBeTruthy();
    expect(payload.exp).toBeGreaterThan(payload.iat!);
    expect(payload.issued_at_ms).toBeGreaterThanOrEqual(payload.iat! * 1000);
  });

  it.each([
    [{ password: 'Admin@123' }, '2001', 400],
    [{ phone: 900000000, password: 'Admin@123' }, '2002', 400],
    [{ phone: '123', password: 'Admin@123' }, '2004', 400],
    [null, '2007', 400],
  ])('rejects invalid input', async (body, code, status) => {
    await expect(service.login(body)).rejects.toMatchObject({
      response: { code, data: {} },
      status,
    });
    expect(findByPhone).not.toHaveBeenCalled();
  });

  it('returns 3007 if the user is missing', async () => {
    findByPhone.mockResolvedValue(null);
    await expect(
      service.login({ phone: '0900000000', password: 'Admin@123' }),
    ).rejects.toMatchObject({ response: { code: '3007' }, status: 404 });
  });

  it('returns 3010 for inactive users', async () => {
    findByPhone.mockResolvedValue({ ...USER, is_active: 0 });
    await expect(
      service.login({ phone: '0900000000', password: 'Admin@123' }),
    ).rejects.toMatchObject({ response: { code: '3010' }, status: 403 });
  });

  it('returns 3008 for a wrong password', async () => {
    await expect(
      service.login({ phone: '0900000000', password: 'wrong' }),
    ).rejects.toMatchObject({ response: { code: '3008' }, status: 401 });
  });

  it('maps database failures to 9902 without leaking details', async () => {
    findByPhone.mockRejectedValue(new Error('private database details'));
    try {
      await service.login({ phone: '0900000000', password: 'Admin@123' });
      throw new Error('Expected login to fail');
    } catch (caught) {
      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getResponse()).toEqual({
        code: '9902',
        message: 'Database error',
        data: {},
      });
    }
  });

  it('signs up a patient with a bcrypt password hash', async () => {
    const result = await service.signup({
      full_name: '  Nguyễn Văn A  ',
      phone: '0912345678',
      password: 'Abc@1234',
      year_of_birth: 1995,
    });

    expect(result).toMatchObject({
      code: '1001',
      message: 'Created successfully',
      data: {
        user_id: 2,
        full_name: 'Nguyễn Văn A',
        phone: '0912345678',
        role_id: 3,
      },
    });
    expect(result.data).not.toHaveProperty('password_hash');
    const input = createPatient.mock.calls[0][0] as {
      passwordHash: string;
      yearOfBirth: number;
      fullName: string;
    };
    expect(input.fullName).toBe('Nguyễn Văn A');
    expect(input.yearOfBirth).toBe(1995);
    expect(await compare('Abc@1234', input.passwordHash)).toBe(true);
  });

  it.each([
    [null, '2007'],
    [{ phone: '0912345678', password: 'Abc@1234' }, '2001'],
    [{ full_name: 'A', phone: 912345678, password: 'Abc@1234' }, '2002'],
    [{ full_name: 'A', phone: '123', password: 'Abc@1234' }, '2004'],
    [{ full_name: 'A', phone: '0912345678', password: '123' }, '2007'],
    [{ full_name: 'A', phone: '0912345678', password: 'Abc@1234', gender: 'invalid' }, '2007'],
    [{ full_name: 'A', phone: '0912345678', password: 'Abc@1234', year_of_birth: 1899 }, '2007'],
  ])('rejects invalid signup input', async (body, code) => {
    await expect(service.signup(body)).rejects.toMatchObject({
      status: 400,
      response: { code },
    });
    expect(createPatient).not.toHaveBeenCalled();
  });

  it('returns 3006 when the phone is already registered', async () => {
    createPatient.mockRejectedValue({ code: '23505', constraint: 'uq_users_phone' });
    await expect(service.signup({
      full_name: 'A', phone: '0912345678', password: 'Abc@1234',
    })).rejects.toMatchObject({ status: 409, response: { code: '3006' } });
  });

  it('does not leak database failures during signup', async () => {
    createPatient.mockRejectedValue(new Error('private database details'));
    await expect(service.signup({
      full_name: 'A', phone: '0912345678', password: 'Abc@1234',
    })).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error', data: {} },
    });
  });
});
