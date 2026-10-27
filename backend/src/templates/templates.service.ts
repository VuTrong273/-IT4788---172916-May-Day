import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TemplatesRepository } from './templates.repository.js';

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function integerParam(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return Number(value);
}

@Injectable()
export class TemplatesService {
  constructor(private readonly templates: TemplatesRepository) {}

  async list(query: Record<string, unknown>) {
    const page = integerParam(query.page, 1);
    const limit = integerParam(query.limit, 20);
    if (limit > 100 || (query.is_active !== undefined && query.is_active !== '0' && query.is_active !== '1')) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.templates.list(page, limit, query.is_active as '0' | '1' | undefined);
      return { code: '1000', message: 'OK', ...result };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async create(user: AuthenticatedUser, body: unknown) {
    let role;
    try { role = await this.templates.roleName(user.roleId); }
    catch { return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE); }
    if (role !== 'admin') return fail('3102', 'Admin role required', HttpStatus.FORBIDDEN);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    const data = body as Record<string, unknown>;
    if (data.code_template === undefined || data.name === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    if (typeof data.code_template !== 'string' || typeof data.name !== 'string' ||
      (data.description !== undefined && typeof data.description !== 'string') ||
      (data.version !== undefined && typeof data.version !== 'string') ||
      (data.is_active !== undefined && typeof data.is_active !== 'string')) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    const code = data.code_template.trim();
    const name = data.name.trim();
    const version = data.version === undefined ? '1.0' : data.version.trim();
    if (!code || code.length > 225 || !name || name.length > 255 || !version || version.length > 20 ||
      (data.is_active !== undefined && data.is_active !== '0' && data.is_active !== '1')) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.templates.create({ code, name, description: data.description ?? null,
        version, active: (data.is_active ?? '1') as '0' | '1', userId: user.userId });
      return { code: '1001', message: 'Created successfully', data: result };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        return fail('4102', 'Template code already exists', HttpStatus.CONFLICT);
      }
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
