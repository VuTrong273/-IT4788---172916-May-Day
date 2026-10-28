import { compare } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DoctorPatientsRepository } from './doctor-patients.repository.js';
import { DoctorPatientsService } from './doctor-patients.service.js';

const doctor: AuthenticatedUser = {
  userId: 2,
  roleId: 2,
  jti: 'test',
  expiresAt: 0,
};
const input = {
  full_name: ' Test Patient ',
  phone: '0912345678',
  password: 'Test@123',
  year_of_birth: 1995,
};

describe('DoctorPatientsService', () => {
  const repository = { roleName: vi.fn(), search: vi.fn(), create: vi.fn() };
  let service: DoctorPatientsService;
  beforeEach(() => {
    vi.resetAllMocks();
    repository.roleName.mockResolvedValue('doctor');
    repository.search.mockResolvedValue([]);
    service = new DoctorPatientsService(
      repository as unknown as DoctorPatientsRepository,
    );
  });

  it('searches by phone prefix and case-insensitive name through the repository', async () => {
    await expect(
      service.search(doctor, { phone: ' 0912 ', full_name: ' Test ' }),
    ).resolves.toMatchObject({ code: '1000', data: [] });
    expect(repository.search).toHaveBeenCalledWith('0912', 'Test');
  });

  it.each([
    {},
    { phone: '   ' },
    { phone: ['0912'] },
    { full_name: {} },
    { full_name: 'x'.repeat(151) },
  ])('rejects invalid search %j', async (query) => {
    await expect(service.search(doctor, query)).rejects.toMatchObject({
      status: 400,
    });
    expect(repository.search).not.toHaveBeenCalled();
  });

  it.each(['patient', 'admin', undefined])(
    'rejects role %s before reading or creating patients',
    async (role) => {
      repository.roleName.mockResolvedValue(role);
      await expect(
        service.search(doctor, { phone: '0912' }),
      ).rejects.toMatchObject({ status: 403, response: { code: '3103' } });
      await expect(service.create(doctor, input)).rejects.toMatchObject({
        status: 403,
      });
      expect(repository.search).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('hashes passwords and returns only the created profile', async () => {
    repository.create.mockResolvedValue({
      user_id: 8,
      full_name: 'Test Patient',
      phone: input.phone,
      year_of_birth: 1995,
    });
    const response = await service.create(doctor, {
      ...input,
      role_id: 1,
      health_insurance_validate: '2028-02-29',
    });
    const saved = repository.create.mock.calls[0][0];
    expect(saved.fullName).toBe('Test Patient');
    expect(saved.password).toBeUndefined();
    expect(saved.role_id).toBeUndefined();
    expect(saved.details.health_insurance_validate).toBe('2028-02-29');
    expect(await compare(input.password, saved.passwordHash)).toBe(true);
    expect(response).toMatchObject({ code: '1001', data: { user_id: 8 } });
    expect(response.data).not.toHaveProperty('passwordHash');
  });

  it.each([
    [null, '2007'],
    [[], '2007'],
    [{}, '2001'],
    [{ ...input, phone: 123 }, '2002'],
    [{ ...input, phone: '1234567890' }, '2004'],
    [{ ...input, full_name: ' ' }, '2007'],
    [{ ...input, password: '123' }, '2007'],
    [{ ...input, password: 'a'.repeat(73) }, '2007'],
    [{ ...input, year_of_birth: '1995' }, '2002'],
    [{ ...input, year_of_birth: 1800 }, '2007'],
    [{ ...input, gender: 'invalid' }, '2007'],
    [{ ...input, career: 1 }, '2002'],
    [{ ...input, ethnic: 'x'.repeat(51) }, '2007'],
    [{ ...input, health_insurance_validate: '2027-02-29' }, '2007'],
  ])('rejects invalid profile %#', async (body, code) => {
    await expect(service.create(doctor, body)).rejects.toMatchObject({
      status: 400,
      response: { code },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('maps duplicate phones to 409', async () => {
    repository.create.mockRejectedValue({ code: '23505' });
    await expect(service.create(doctor, input)).rejects.toMatchObject({
      status: 409,
      response: { code: '3006' },
    });
  });

  it('reports database outages without leaking database errors', async () => {
    repository.search.mockRejectedValue(new Error('private database details'));
    await expect(
      service.search(doctor, { phone: '0912' }),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: '9902', message: 'Database error' },
    });
  });
});
