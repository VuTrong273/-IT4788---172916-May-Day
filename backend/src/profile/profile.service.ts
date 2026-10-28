import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  PatientProfileRequiredError,
  type ProfileChanges,
  UserRepository,
} from '../auth/user.repository.js';

const PATIENT_TEXT_LIMITS: Record<string, number> = {
  career: 150,
  ethnic: 50,
  hamlet_address: 150,
  commune_address: 150,
  city_address: 150,
  work_place: 255,
  health_insurance_number: 30,
  next_of_kin_name: 150,
  next_of_kin_phone: 20,
};

function profileError(
  code: string,
  message: string,
  status: HttpStatus,
): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function parseProfileChanges(body: unknown): ProfileChanges {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return profileError(
      '2007',
      'Request body is invalid',
      HttpStatus.BAD_REQUEST,
    );
  }
  const values = body as Record<string, unknown>;
  if (Object.keys(values).length === 0) {
    return profileError(
      '2001',
      'Missing required parameter',
      HttpStatus.BAD_REQUEST,
    );
  }

  const changes: ProfileChanges = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === 'role_id') {
      return profileError(
        '2003',
        'Invalid parameter value',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (key === 'phone') {
      if (typeof value !== 'string')
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      const phone = value.trim();
      if (!/^(03|05|07|08|09)\d{8}$/.test(phone))
        return profileError(
          '2003',
          'Invalid phone number',
          HttpStatus.BAD_REQUEST,
        );
      changes.phone = phone;
    } else if (key === 'full_name') {
      if (typeof value !== 'string') {
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      }
      const name = value.trim();
      if (!name || name.length > 150) {
        return profileError(
          '2003',
          'Invalid parameter value',
          HttpStatus.BAD_REQUEST,
        );
      }
      changes.full_name = name;
    } else if (key === 'gender') {
      if (value !== null && typeof value !== 'string') {
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (value !== null && !['male', 'female', 'other'].includes(value)) {
        return profileError(
          '2003',
          'Invalid parameter value',
          HttpStatus.BAD_REQUEST,
        );
      }
      changes.gender = value;
    } else if (key === 'year_of_birth') {
      if (value !== null && typeof value !== 'number') {
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (
        value !== null &&
        (!Number.isInteger(value) || value < 1900 || value > 2100)
      ) {
        return profileError(
          '2003',
          'Invalid parameter value',
          HttpStatus.BAD_REQUEST,
        );
      }
      changes.year_of_birth = value;
    } else if (key === 'health_insurance_validate') {
      if (value !== null && typeof value !== 'string') {
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (value !== null) {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(`${value}T00:00:00.000Z`)
          : null;
        if (
          !date ||
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value
        ) {
          return profileError(
            '2003',
            'Invalid parameter value',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      changes.health_insurance_validate = value;
    } else if (Object.hasOwn(PATIENT_TEXT_LIMITS, key)) {
      if (value !== null && typeof value !== 'string') {
        return profileError(
          '2002',
          'Invalid parameter type',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (
        typeof value === 'string' &&
        value.length > PATIENT_TEXT_LIMITS[key]
      ) {
        return profileError(
          '2003',
          'Invalid parameter value',
          HttpStatus.BAD_REQUEST,
        );
      }
      changes[key] = value;
    } else {
      return profileError(
        '2007',
        'Request body is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  return changes;
}

@Injectable()
export class ProfileService {
  constructor(private readonly users: UserRepository) {}

  async getProfile(userId: number) {
    let profile;
    try {
      profile = await this.users.findProfile(userId);
    } catch {
      throw new HttpException(
        { code: '9902', message: 'Database error', data: {} },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!profile) {
      throw new HttpException(
        { code: '3007', message: 'User account not found', data: {} },
        HttpStatus.NOT_FOUND,
      );
    }
    return { code: '1000', message: 'OK', data: profile };
  }

  async updateProfile(userId: number, body: unknown) {
    const changes = parseProfileChanges(body);
    let profile;
    try {
      profile = await this.users.updateProfile(userId, changes);
    } catch (caught) {
      if (
        typeof caught === 'object' &&
        caught !== null &&
        'code' in caught &&
        caught.code === '23505'
      ) {
        return profileError(
          '3006',
          'User phone already exists',
          HttpStatus.CONFLICT,
        );
      }
      if (caught instanceof PatientProfileRequiredError) {
        return profileError(
          '2003',
          'Invalid parameter value',
          HttpStatus.BAD_REQUEST,
        );
      }
      return profileError(
        '9902',
        'Database error',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!profile) {
      return profileError(
        '3007',
        'User account not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return { code: '1000', message: 'OK', data: profile };
  }
}
