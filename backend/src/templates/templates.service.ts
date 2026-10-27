import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TemplatesRepository } from './templates.repository.js';

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function integerParam(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return Number(value);
}

function parseTemplateUpdate(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }
  const allowed = ['name', 'description', 'version', 'is_active'];
  const entries = Object.entries(body);
  if (!entries.length || entries.some(([key]) => !allowed.includes(key))) {
    return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }
  const fields: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value !== 'string')
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    const normalized = value.trim();
    if (
      (key === 'name' && (!normalized || normalized.length > 255)) ||
      (key === 'version' && (!normalized || normalized.length > 20)) ||
      (key === 'is_active' && value !== '0' && value !== '1')
    ) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    fields[key] = normalized;
  }
  return fields;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly templates: TemplatesRepository) {}

  private async requireAdmin(user: AuthenticatedUser) {
    let role;
    try {
      role = await this.templates.roleName(user.roleId);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (role !== 'admin')
      return fail('3102', 'Admin role required', HttpStatus.FORBIDDEN);
  }

  async update(user: AuthenticatedUser, code: string, body: unknown) {
    await this.requireAdmin(user);
    const fields = parseTemplateUpdate(body);
    let data;
    try {
      data = await this.templates.update(code, fields);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!data) return fail('4101', 'Template not found', HttpStatus.NOT_FOUND);
    return { code: '1000', message: 'OK', data };
  }

  async delete(user: AuthenticatedUser, code: string) {
    await this.requireAdmin(user);
    let deleted;
    try {
      deleted = await this.templates.delete(code);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23503'
      ) {
        return fail(
          '4105',
          'Template is in use and cannot be deleted',
          HttpStatus.CONFLICT,
        );
      }
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!deleted)
      return fail('4101', 'Template not found', HttpStatus.NOT_FOUND);
    return { code: '1000', message: 'OK', data: {} };
  }

  async list(query: Record<string, unknown>) {
    const page = integerParam(query.page, 1);
    const limit = integerParam(query.limit, 20);
    if (
      limit > 100 ||
      (query.is_active !== undefined &&
        query.is_active !== '0' &&
        query.is_active !== '1')
    ) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.templates.list(
        page,
        limit,
        query.is_active as '0' | '1' | undefined,
      );
      return { code: '1000', message: 'OK', ...result };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async get(code: string) {
    if (!code.trim() || code.length > 225) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    let data;
    try {
      data = await this.templates.getByCode(code);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!data) return fail('4101', 'Template not found', HttpStatus.NOT_FOUND);
    return { code: '1000', message: 'OK', data };
  }

  async create(user: AuthenticatedUser, body: unknown) {
    await this.requireAdmin(user);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    const data = body as Record<string, unknown>;
    if (data.code_template === undefined || data.name === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    if (
      typeof data.code_template !== 'string' ||
      typeof data.name !== 'string' ||
      (data.description !== undefined &&
        typeof data.description !== 'string') ||
      (data.version !== undefined && typeof data.version !== 'string') ||
      (data.is_active !== undefined && typeof data.is_active !== 'string')
    ) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    const code = data.code_template.trim();
    const name = data.name.trim();
    const version = data.version === undefined ? '1.0' : data.version.trim();
    if (
      !code ||
      code.length > 225 ||
      !name ||
      name.length > 255 ||
      !version ||
      version.length > 20 ||
      (data.is_active !== undefined &&
        data.is_active !== '0' &&
        data.is_active !== '1')
    ) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.templates.create({
        code,
        name,
        description: data.description ?? null,
        version,
        active: (data.is_active ?? '1') as '0' | '1',
        userId: user.userId,
      });
      return { code: '1001', message: 'Created successfully', data: result };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return fail(
          '4102',
          'Template code already exists',
          HttpStatus.CONFLICT,
        );
      }
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
