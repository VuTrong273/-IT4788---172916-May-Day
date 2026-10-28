import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DoctorPatientsRepository } from './doctor-patients.repository.js';
import { parsePatient, patientError } from './doctor-patients.validation.js';

@Injectable()
export class DoctorPatientsService {
  constructor(private readonly patients: DoctorPatientsRepository) {}

  private async requireDoctor(user: AuthenticatedUser) {
    let role;
    try {
      role = await this.patients.roleName(user.roleId);
    } catch {
      return patientError('9902', 'Database error', 503);
    }
    if (role !== 'doctor') patientError('3103', 'Doctor role required', 403);
  }

  async search(user: AuthenticatedUser, query: Record<string, unknown>) {
    await this.requireDoctor(user);
    for (const key of ['phone', 'full_name']) {
      if (query[key] !== undefined && typeof query[key] !== 'string')
        patientError('2001', 'Invalid search parameter');
    }
    const phone = (query.phone as string | undefined)?.trim() ?? '';
    const name = (query.full_name as string | undefined)?.trim() ?? '';
    if ((!phone && !name) || phone.length > 10 || name.length > 150)
      patientError('2001', 'Enter a phone number or full name');
    try {
      return {
        code: '1000',
        message: 'OK',
        data: await this.patients.search(phone, name),
      };
    } catch {
      return patientError('9902', 'Database error', 503);
    }
  }

  async create(user: AuthenticatedUser, body: unknown) {
    await this.requireDoctor(user);
    const { password, ...input } = parsePatient(body);
    const passwordHash = await hash(password, 10);
    try {
      const data = await this.patients.create({ ...input, passwordHash });
      return { code: '1001', message: 'Created successfully', data };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return patientError('3006', 'User phone already exists', 409);
      }
      return patientError('9902', 'Database error', 503);
    }
  }
}
