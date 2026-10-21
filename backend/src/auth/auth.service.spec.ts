import { HttpException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { jwtVerify } from 'jose';
import { AuthService } from './auth.service.js';
import { MailService } from './mail.service.js';
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
  let blacklistToken: ReturnType<typeof vi.fn>;
  let findPasswordHash: ReturnType<typeof vi.fn>;
  let changePassword: ReturnType<typeof vi.fn>;
  let findRecoveryTarget: ReturnType<typeof vi.fn>;
  let requestPasswordReset: ReturnType<typeof vi.fn>;
  let finishPasswordReset: ReturnType<typeof vi.fn>;
  let requestRecoveryEmail: ReturnType<typeof vi.fn>;
  let verifyRecoveryEmail: ReturnType<typeof vi.fn>;
  let sendOtp: ReturnType<typeof vi.fn>;
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
    blacklistToken = vi.fn().mockResolvedValue(undefined);
    findPasswordHash = vi.fn().mockImplementation(() => USER.password_hash);
    changePassword = vi.fn().mockResolvedValue(true);
    findRecoveryTarget = vi.fn().mockResolvedValue({
      user_id: 1,
      recovery_email: 'patient@example.com',
      is_active: 1,
    });
    requestPasswordReset = vi.fn().mockResolvedValue(true);
    finishPasswordReset = vi.fn().mockResolvedValue('success');
    requestRecoveryEmail = vi.fn().mockResolvedValue(true);
    verifyRecoveryEmail = vi.fn().mockResolvedValue('success');
    sendOtp = vi.fn().mockResolvedValue(undefined);
    service = new AuthService({
      findByPhone,
      createPatient,
      blacklistToken,
      findPasswordHash,
      changePassword,
      findRecoveryTarget,
      requestPasswordReset,
      finishPasswordReset,
      requestRecoveryEmail,
      verifyRecoveryEmail,
    } as unknown as UserRepository, { sendOtp } as unknown as MailService);
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

  it('emails a real OTP without returning it in the forgot-password response', async () => {
    const response = await service.forgotPassword({ email: 'Patient@Example.com' });
    expect(response).toMatchObject({ code: '1000', data: { expires_in: 600 } });
    expect(response.data).not.toHaveProperty('dev_otp');
    expect(findRecoveryTarget).toHaveBeenCalledWith('patient@example.com');
    expect(requestPasswordReset).toHaveBeenCalledWith(1, expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(sendOtp).toHaveBeenCalledWith('patient@example.com', expect.stringMatching(/^\d{6}$/), 'reset');
  });

  it('uses the same OTP hash for sending and resetting a password', async () => {
    await service.forgotPassword({ email: 'patient@example.com' });
    const code = sendOtp.mock.calls[0][1] as string;
    await service.resetPassword({
      email: 'Patient@Example.com',
      otp: code,
      new_password: 'NewPassword1',
      confirm_password: 'NewPassword1',
    });
    expect(finishPasswordReset).toHaveBeenCalledWith(
      'patient@example.com',
      requestPasswordReset.mock.calls[0][1],
      expect.any(String),
    );
  });

  it('does not reveal whether an account has a recovery email', async () => {
    findRecoveryTarget.mockResolvedValue(null);
    const response = await service.forgotPassword({ email: 'unknown@example.com' });
    expect(response.code).toBe('1000');
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it('sends email verification only after checking the current password', async () => {
    await service.requestRecoveryEmail(
      { userId: 1, roleId: 1, jti: 'jti', expiresAt: 1 },
      { email: 'Patient@Example.com', password: 'Admin@123' },
    );
    expect(requestRecoveryEmail).toHaveBeenCalledWith(
      1, 'patient@example.com', expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(sendOtp).toHaveBeenCalledWith('patient@example.com', expect.stringMatching(/^\d{6}$/), 'verify');
  });

  it('returns OTP error for an invalid reset code', async () => {
    finishPasswordReset.mockResolvedValue('invalid');
    await expect(service.resetPassword({
      email: 'patient@example.com', otp: '123456', new_password: 'NewPassword1', confirm_password: 'NewPassword1',
    })).rejects.toMatchObject({ response: { code: '3004' }, status: 400 });
  });

  it('requires email, not phone, for password recovery', async () => {
    await expect(service.forgotPassword({ phone: USER.phone })).rejects.toMatchObject({
      response: { code: '2001' }, status: 400,
    });
    await expect(service.forgotPassword({ email: 'not-an-email' })).rejects.toMatchObject({
      response: { code: '2003' }, status: 400,
    });
    expect(findRecoveryTarget).not.toHaveBeenCalled();
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

  it('blacklists the current token until its expiration time', async () => {
    const result = await service.logout({
      userId: 7,
      roleId: 3,
      jti: 'current-jti',
      expiresAt: 1_800_000_000,
    });

    expect(blacklistToken).toHaveBeenCalledWith(
      7,
      'current-jti',
      new Date(1_800_000_000_000),
    );
    expect(result).toEqual({ code: '1000', message: 'OK', data: {} });
  });

  it('maps a logout database failure to 9902', async () => {
    blacklistToken.mockRejectedValue(new Error('private database details'));
    await expect(service.logout({
      userId: 7,
      roleId: 3,
      jti: 'current-jti',
      expiresAt: 1_800_000_000,
    })).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error', data: {} },
    });
  });

  const sessionUser = {
    userId: 1,
    roleId: 1,
    jti: 'change-jti',
    expiresAt: 1_800_000_000,
  };

  it('changes the password and revokes the current token', async () => {
    const result = await service.changePassword(sessionUser, {
      old_password: 'Admin@123',
      new_password: 'New@12345',
      confirm_password: 'New@12345',
    });

    expect(result).toEqual({ code: '1000', message: 'OK', data: {} });
    expect(findPasswordHash).toHaveBeenCalledWith(1);
    const [userId, expectedHash, newHash, jti, expiresAt] = changePassword.mock.calls[0];
    expect(userId).toBe(1);
    expect(expectedHash).toBe(USER.password_hash);
    expect(await compare('New@12345', newHash as string)).toBe(true);
    expect(jti).toBe('change-jti');
    expect(expiresAt).toEqual(new Date(1_800_000_000_000));
  });

  it.each([
    [null, '2007'],
    [{ old_password: 'Admin@123' }, '2001'],
    [{ old_password: 123, new_password: 'New@12345', confirm_password: 'New@12345' }, '2002'],
    [{ old_password: 'Admin@123', new_password: 'short', confirm_password: 'short' }, '2003'],
    [{ old_password: 'Admin@123', new_password: 'New@12345', confirm_password: 'different' }, '2003'],
    [{ old_password: 'Admin@123', new_password: 'Admin@123', confirm_password: 'Admin@123' }, '2003'],
  ])('rejects invalid change-password input', async (body, code) => {
    await expect(service.changePassword(sessionUser, body)).rejects.toMatchObject({
      status: 400,
      response: { code },
    });
    expect(findPasswordHash).not.toHaveBeenCalled();
  });

  it('rejects an incorrect old password', async () => {
    await expect(service.changePassword(sessionUser, {
      old_password: 'Wrong@123', new_password: 'New@12345', confirm_password: 'New@12345',
    })).rejects.toMatchObject({ status: 400, response: { code: '3009' } });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects a concurrent password change', async () => {
    changePassword.mockResolvedValue(false);
    await expect(service.changePassword(sessionUser, {
      old_password: 'Admin@123', new_password: 'New@12345', confirm_password: 'New@12345',
    })).rejects.toMatchObject({ status: 400, response: { code: '3009' } });
  });

  it('maps change-password database failures to 9902', async () => {
    changePassword.mockRejectedValue(new Error('private database details'));
    await expect(service.changePassword(sessionUser, {
      old_password: 'Admin@123', new_password: 'New@12345', confirm_password: 'New@12345',
    })).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error', data: {} },
    });
  });
});
