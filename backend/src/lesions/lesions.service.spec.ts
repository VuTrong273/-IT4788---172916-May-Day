import { Readable } from 'node:stream';
import { LesionsService } from './lesions.service.js';
import { LesionsRepository } from './lesions.repository.js';
import { ObjectStorageService } from './object-storage.service.js';
import { authorize } from './lesions.validation.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
const patient: AuthenticatedUser = {
  userId: 15,
  roleId: 3,
  jti: 'test',
  expiresAt: 0,
};
const doctor = { ...patient, userId: 8, roleId: 2 };
const file = {
  buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  mimetype: 'image/png',
  originalname: 'test.png',
  size: 8,
};

describe('LesionsService', () => {
  const query = vi.fn(),
    withRecord = vi.fn(),
    role = vi.fn(),
    episodePatient = vi.fn();
  const storage = { put: vi.fn(), get: vi.fn(), remove: vi.fn() };
  let service: LesionsService;
  beforeEach(() => {
    vi.resetAllMocks();
    role.mockImplementation((user: AuthenticatedUser) =>
      Promise.resolve(user.roleId === 3 ? 'patient' : 'doctor'),
    );
    episodePatient.mockResolvedValue(15);
    withRecord.mockImplementation(
      async (
        user: AuthenticatedUser,
        _id: number,
        write: boolean,
        action: (client: unknown, record: unknown) => Promise<unknown>,
      ) => {
        const record = authorize(
          {
            medical_record_id: 1,
            patient_id: 15,
            assigned_doctor_id: 8,
            status: 'in_progress',
          },
          user.userId,
          await role(user),
          write,
        );
        return action({ query }, record);
      },
    );
    service = new LesionsService(
      {
        role,
        withRecord,
        episodePatient,
        withPatient: async (
          user: AuthenticatedUser,
          patientId: number,
          _write: boolean,
          action: (client: unknown) => Promise<unknown>,
        ) => {
          if (
            (user.roleId === 3 && user.userId !== patientId) ||
            (user.roleId === 2 && user.userId !== 8)
          ) {
            const { fail } = await import('./lesions.validation.js');
            fail('3106', 'Private patient diary', 403);
          }
          return action({ query });
        },
        pool: { query },
      } as unknown as LesionsRepository,
      storage as unknown as ObjectStorageService,
    );
  });
  it('returns timelines only after checking record access', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.episodes(doctor, '1')).resolves.toMatchObject({
      code: '1000',
      data: [],
    });
    await expect(
      service.episodes({ ...doctor, userId: 9 }, '1'),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not allow doctors to create patient episode data', async () => {
    await expect(
      service.createEpisode(doctor, {
        medical_record_id: '1',
        name: 'episode',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects invalid context tags', async () => {
    await expect(
      service.createEpisode(patient, {
        medical_record_id: '1',
        name: 'episode',
        context_tags: '{}',
      }),
    ).rejects.toMatchObject({ response: { code: '7004' } });
  });
  it('rejects photos belonging to another uploader', async () => {
    query.mockResolvedValue({ rows: [{ user_id: 16, medical_record_id: 1 }] });
    await expect(
      service.createPhoto(patient, {
        episode_id: '2',
        attachment_id: '3',
        milestone: 'start',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects attaching a location from another episode', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.createPhoto(patient, {
        episode_id: '2',
        attachment_id: '3',
        location_id: '99',
        milestone: 'start',
      }),
    ).rejects.toMatchObject({ response: { code: '7002' } });
  });
  it('allows the same patient to use an image from an earlier visit', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ user_id: 15, medical_record_id: 99 }] })
      .mockResolvedValueOnce({ rows: [{ photo_id: 4 }] })
      .mockResolvedValueOnce({ rows: [{ photo_id: '4' }] });
    await expect(
      service.createPhoto(patient, {
        episode_id: '2',
        attachment_id: '3',
        milestone: 'normal',
      }),
    ).resolves.toMatchObject({ code: '1001' });
  });
  it('creates an episode without a visit and uses the authenticated patient', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ episode_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ episode_id: '2', patient_id: '15' }] });
    await expect(
      service.createEpisode(patient, { name: 'Diary', patient_id: 999 }),
    ).resolves.toMatchObject({ code: '1001' });
    expect(query.mock.calls[0][1].slice(0, 2)).toEqual([null, 15]);
  });
  it('checks patient access before returning a cross-visit diary', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.patientEpisodes(doctor, '15')).resolves.toMatchObject({
      code: '1000',
    });
    await expect(
      service.patientEpisodes({ ...doctor, userId: 9 }, '15'),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('validates every file before starting upload', async () => {
    await expect(
      service.upload(patient, { medical_record_id: '1' }, [
        file,
        { ...file, mimetype: 'image/jpeg' },
      ]),
    ).rejects.toMatchObject({ response: { code: '6002' } });
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('cleans uploaded objects when database insertion fails', async () => {
    query.mockRejectedValue(new Error('database offline'));
    await expect(
      service.upload(patient, { medical_record_id: '1' }, [file]),
    ).rejects.toMatchObject({ status: 503 });
    expect(storage.remove).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('maps storage failures without inserting metadata', async () => {
    storage.put.mockRejectedValue(new Error('offline'));
    await expect(
      service.upload(patient, { medical_record_id: '1' }, [file]),
    ).rejects.toMatchObject({ status: 502, response: { code: '6007' } });
    expect(query).not.toHaveBeenCalled();
  });
  it('returns a private API URL for uploaded images', async () => {
    query.mockResolvedValue({ rows: [{ id: '3' }] });
    await expect(
      service.upload(patient, { medical_record_id: '1' }, [file]),
    ).resolves.toMatchObject({
      data: [{ id: '3', file_url: '/image-attachments/3/content' }],
    });
  });
  it('refuses to download private unlinked images for another user', async () => {
    query.mockResolvedValue({
      rows: [{ user_id: 15, medical_record_id: null, file_path: 'private' }],
    });
    await expect(service.content(doctor, '3')).rejects.toMatchObject({
      status: 403,
    });
    expect(storage.get).not.toHaveBeenCalled();
  });
  it('downloads assigned record images through the authenticated stream', async () => {
    query.mockResolvedValue({
      rows: [
        {
          user_id: 15,
          medical_record_id: 1,
          file_path: 'private',
          file_type: 'image/png',
          file_size: 8,
        },
      ],
    });
    storage.get.mockResolvedValue(Readable.from(file.buffer));
    const response = await service.content(doctor, '3');
    expect(response.getHeaders()).toMatchObject({
      type: 'image/png',
      length: 8,
    });
    await expect(
      service.content({ ...doctor, userId: 9 }, '3'),
    ).rejects.toMatchObject({ status: 403 });
  });
});
