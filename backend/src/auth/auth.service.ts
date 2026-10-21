import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { UserRepository, type NewPatient } from './user.repository.js';

const PHONE_PATTERN = /^(03|05|07|08|09)[0-9]{8}$/;

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
  constructor(private readonly users: UserRepository) {}

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
