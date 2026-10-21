import { PatientProfileRequiredError, UserRepository } from '../auth/user.repository.js';
import { ProfileService } from './profile.service.js';

describe('ProfileService.updateProfile', () => {
  const profile = {
    user_id: 7,
    full_name: 'Nguyễn Văn A',
    phone: '0912345678',
    role_id: 3,
  };
  let updateProfile: ReturnType<typeof vi.fn>;
  let service: ProfileService;

  beforeEach(() => {
    updateProfile = vi.fn().mockResolvedValue(profile);
    service = new ProfileService({ updateProfile } as unknown as UserRepository);
  });

  it('updates only the current user and trims the name', async () => {
    await expect(service.updateProfile(7, { full_name: '  Nguyễn Văn A  ' }))
      .resolves.toEqual({ code: '1000', message: 'OK', data: profile });
    expect(updateProfile).toHaveBeenCalledWith(7, { full_name: 'Nguyễn Văn A' });
  });

  it('accepts a partial patient profile, including clearing nullable fields', async () => {
    await service.updateProfile(7, {
      year_of_birth: 1995,
      career: null,
      health_insurance_validate: '2027-12-31',
    });
    expect(updateProfile).toHaveBeenCalledWith(7, {
      year_of_birth: 1995,
      career: null,
      health_insurance_validate: '2027-12-31',
    });
  });

  it.each([
    [null, '2007'],
    [{}, '2001'],
    [{ full_name: 12 }, '2002'],
    [{ full_name: '  ' }, '2003'],
    [{ phone: '0900000000' }, '2003'],
    [{ role_id: 1 }, '2003'],
    [{ year_of_birth: '1995' }, '2002'],
    [{ year_of_birth: 1899 }, '2003'],
    [{ gender: 'invalid' }, '2003'],
    [{ health_insurance_validate: '2027-02-30' }, '2003'],
    [{ unknown: 'value' }, '2007'],
  ])('rejects invalid changes', async (body, code) => {
    await expect(service.updateProfile(7, body)).rejects.toMatchObject({
      status: 400,
      response: { code },
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('rejects patient-only fields for a non-patient account', async () => {
    updateProfile.mockRejectedValue(new PatientProfileRequiredError());
    await expect(service.updateProfile(7, { career: 'Teacher' }))
      .rejects.toMatchObject({ status: 400, response: { code: '2003' } });
  });

  it('returns 3007 when the user no longer exists', async () => {
    updateProfile.mockResolvedValue(null);
    await expect(service.updateProfile(7, { full_name: 'Nguyễn Văn A' }))
      .rejects.toMatchObject({ status: 404, response: { code: '3007' } });
  });

  it('maps database errors without leaking details', async () => {
    updateProfile.mockRejectedValue(new Error('private database details'));
    await expect(service.updateProfile(7, { full_name: 'Nguyễn Văn A' }))
      .rejects.toMatchObject({
        status: 503,
        response: { code: '9902', message: 'Database error', data: {} },
      });
  });
});
