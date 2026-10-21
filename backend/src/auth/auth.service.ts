import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import type { AuthenticatedUser } from './jwt-auth.guard.js';
import { UserRepository, type NewPatient } from './user.repository.js';
import { MailService } from './mail.service.js';

const PHONE_PATTERN = /^(03|05|07|08|09)[0-9]{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

function error(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function parseLogin(body: unknown): { phone: string; password: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return error('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }

  const values = body as Record<string, unknown>;
  if (values.phone === undefined || values.password === undefined) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (typeof values.phone !== 'string' || typeof values.password !== 'string') {
    return error('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  }
  if (!PHONE_PATTERN.test(values.phone)) {
    return error('2004', 'Invalid phone number format', HttpStatus.BAD_REQUEST);
  }
  if (values.password.length === 0) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  return { phone: values.phone, password: values.password };
}

function parseSignup(body: unknown): Omit<NewPatient, 'passwordHash'> & { password: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return error('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }

  const values = body as Record<string, unknown>;
  if (
    values.full_name === undefined ||
    values.phone === undefined ||
    values.password === undefined
  ) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (
    typeof values.full_name !== 'string' ||
    typeof values.phone !== 'string' ||
    typeof values.password !== 'string' ||
    (values.gender !== undefined && typeof values.gender !== 'string') ||
    (values.year_of_birth !== undefined && typeof values.year_of_birth !== 'number')
  ) {
    return error('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  }

  const fullName = values.full_name.trim();
  if (!fullName || !values.password) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (!PHONE_PATTERN.test(values.phone)) {
    return error('2004', 'Invalid phone number format', HttpStatus.BAD_REQUEST);
  }
  if (
    values.password.length < 6 ||
    (values.gender !== undefined &&
      !['male', 'female', 'other'].includes(values.gender)) ||
    (values.year_of_birth !== undefined &&
      (!Number.isInteger(values.year_of_birth) ||
        values.year_of_birth < 1900 ||
        values.year_of_birth > 2100))
  ) {
    return error('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }

  return {
    fullName,
    phone: values.phone,
    password: values.password,
    ...(values.gender !== undefined && {
      gender: values.gender as NewPatient['gender'],
    }),
    ...(values.year_of_birth !== undefined && {
      yearOfBirth: values.year_of_birth,
    }),
  };
}

function parseChangePassword(body: unknown): { oldPassword: string; newPassword: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return error('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }
  const values = body as Record<string, unknown>;
  if (
    values.old_password === undefined ||
    values.new_password === undefined ||
    values.confirm_password === undefined
  ) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (
    typeof values.old_password !== 'string' ||
    typeof values.new_password !== 'string' ||
    typeof values.confirm_password !== 'string'
  ) {
    return error('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  }
  if (!values.old_password || !values.new_password || !values.confirm_password) {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (
    values.new_password.length < 6 ||
    values.new_password !== values.confirm_password ||
    values.new_password === values.old_password
  ) {
    return error('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return { oldPassword: values.old_password, newPassword: values.new_password };
}

function parseObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return error('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }
  return body as Record<string, unknown>;
}

function requiredString(values: Record<string, unknown>, key: string): string {
  const value = values[key];
  if (value === undefined || value === '') {
    return error('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (typeof value !== 'string') {
    return error('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  }
  return value;
}

function parseRecoveryEmail(body: unknown): string {
  const email = requiredString(parseObject(body), 'email').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return error('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return email;
}

function parseOtp(body: unknown): string {
  const otp = requiredString(parseObject(body), 'otp');
  if (!OTP_PATTERN.test(otp)) {
    return error('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return otp;
}

function otpHash(purpose: 'verify' | 'reset', ownerId: number | string, otp: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return error('9901', 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
  return createHmac('sha256', secret).update(`${purpose}:${ownerId}:${otp}`).digest('hex');
}

function createOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function isPhoneConflict(caught: unknown): boolean {
  return (
    typeof caught === 'object' &&
    caught !== null &&
    'code' in caught &&
    caught.code === '23505' &&
    'constraint' in caught &&
    caught.constraint === 'uq_users_phone'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly mail: MailService,
  ) {}

  async requestRecoveryEmail(user: AuthenticatedUser, body: unknown) {
    const values = parseObject(body);
    const email = requiredString(values, 'email').trim().toLowerCase();
    const password = requiredString(values, 'password');
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return error('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    let currentHash;
    try {
      currentHash = await this.users.findPasswordHash(user.userId);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!currentHash || !(await compare(password, currentHash))) {
      return error('3009', 'Password is incorrect', HttpStatus.BAD_REQUEST);
    }
    const code = createOtp();
    const hashed = otpHash('verify', user.userId, code);
    let requested;
    try {
      requested = await this.users.requestRecoveryEmail(user.userId, email, hashed);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!requested) return error('2003', 'Email already set or request too soon', HttpStatus.BAD_REQUEST);
    try {
      await this.mail.sendOtp(email, code, 'verify');
    } catch {
      await this.users.cancelRecoveryEmail(user.userId, hashed).catch(() => undefined);
      return error('9903', 'Email delivery failed', HttpStatus.BAD_GATEWAY);
    }
    return { code: '1000', message: 'OTP has been sent to your email', data: { expires_in: 600 } };
  }

  async verifyRecoveryEmail(user: AuthenticatedUser, body: unknown) {
    const hashed = otpHash('verify', user.userId, parseOtp(body));
    let result;
    try {
      result = await this.users.verifyRecoveryEmail(user.userId, hashed);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (result === 'success') return { code: '1000', message: 'OK', data: {} };
    if (result === 'conflict') return error('3006', 'Email already in use', HttpStatus.CONFLICT);
    if (result === 'expired' || result === 'missing') {
      return error('3005', 'OTP expired', HttpStatus.BAD_REQUEST);
    }
    return error('3004', 'OTP is incorrect', HttpStatus.BAD_REQUEST);
  }

  async forgotPassword(body: unknown) {
    const email = parseRecoveryEmail(body);
    let target;
    try {
      target = await this.users.findRecoveryTarget(email);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const response = { code: '1000', message: 'If an email is registered, an OTP has been sent', data: { expires_in: 600 } };
    if (!target?.recovery_email || target.is_active !== 1) return response;

    const code = createOtp();
    const hashed = otpHash('reset', email, code);
    let requested;
    try {
      requested = await this.users.requestPasswordReset(target.user_id, hashed);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!requested) return response;
    try {
      await this.mail.sendOtp(target.recovery_email, code, 'reset');
    } catch {
      await this.users.cancelPasswordReset(target.user_id, hashed).catch(() => undefined);
      return error('9903', 'Email delivery failed', HttpStatus.BAD_GATEWAY);
    }
    return response;
  }

  async resetPassword(body: unknown) {
    const values = parseObject(body);
    const email = parseRecoveryEmail(body);
    const otp = parseOtp(body);
    const newPassword = requiredString(values, 'new_password');
    const confirmPassword = requiredString(values, 'confirm_password');
    if (newPassword.length < 6 || newPassword !== confirmPassword) {
      return error('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    const hashed = otpHash('reset', email, otp);
    const newHash = await hash(newPassword, 10);
    let result;
    try {
      result = await this.users.finishPasswordReset(email, hashed, newHash);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (result === 'success') return { code: '1000', message: 'OK', data: {} };
    if (result === 'invalid') return error('3004', 'OTP is incorrect', HttpStatus.BAD_REQUEST);
    return error('3005', 'OTP expired', HttpStatus.BAD_REQUEST);
  }

  async changePassword(user: AuthenticatedUser, body: unknown) {
    const { oldPassword, newPassword } = parseChangePassword(body);
    let currentHash;
    try {
      currentHash = await this.users.findPasswordHash(user.userId);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!currentHash || !(await compare(oldPassword, currentHash))) {
      return error('3009', 'Old password is incorrect', HttpStatus.BAD_REQUEST);
    }

    const newHash = await hash(newPassword, 10);
    let changed;
    try {
      changed = await this.users.changePassword(
        user.userId,
        currentHash,
        newHash,
        user.jti,
        new Date(user.expiresAt * 1000),
      );
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!changed) {
      return error('3009', 'Old password is incorrect', HttpStatus.BAD_REQUEST);
    }
    return { code: '1000', message: 'OK', data: {} };
  }

  async logout(user: AuthenticatedUser) {
    try {
      await this.users.blacklistToken(
        user.userId,
        user.jti,
        new Date(user.expiresAt * 1000),
      );
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { code: '1000', message: 'OK', data: {} };
  }

  async signup(body: unknown) {
    const { password, ...input } = parseSignup(body);
    const passwordHash = await hash(password, 10);
    let created;
    try {
      created = await this.users.createPatient({ ...input, passwordHash });
    } catch (caught) {
      if (isPhoneConflict(caught)) {
        return error('3006', 'User phone already exists', HttpStatus.CONFLICT);
      }
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      code: '1001',
      message: 'Created successfully',
      data: {
        user_id: created.user_id,
        full_name: created.full_name,
        phone: created.phone,
        ...(created.gender && { gender: created.gender }),
        role_id: created.role_id,
        is_active: created.is_active,
        created_at: created.created_at,
      },
    };
  }

  async login(body: unknown) {
    const { phone, password } = parseLogin(body);
    let user;
    try {
      user = await this.users.findByPhone(phone);
    } catch {
      return error('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!user) {
      return error('3007', 'User account not found', HttpStatus.NOT_FOUND);
    }
    if (user.is_active !== 1) {
      return error('3010', 'User account is deactivated', HttpStatus.FORBIDDEN);
    }
    if (!(await compare(password, user.password_hash))) {
      return error('3008', 'Password is incorrect', HttpStatus.UNAUTHORIZED);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      return error('9901', 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const issuedAtMs = Date.now();
    const token = await new SignJWT({
      role_id: user.role_id,
      issued_at_ms: issuedAtMs,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(String(user.user_id))
      .setJti(randomUUID())
      .setIssuedAt(Math.floor(issuedAtMs / 1000))
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    return {
      code: '1000',
      message: 'OK',
      data: {
        token,
        user_info: {
          user_id: user.user_id,
          full_name: user.full_name,
          phone: user.phone,
          role_id: user.role_id,
        },
      },
    };
  }
}
