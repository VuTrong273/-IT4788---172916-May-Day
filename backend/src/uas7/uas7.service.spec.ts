import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { Uas7Repository } from './uas7.repository.js';
import { Uas7Service } from './uas7.service.js';

const patient: AuthenticatedUser = {
  userId: 15,
  roleId: 3,
  jti: 'test',
  expiresAt: 0,
};
const doctor: AuthenticatedUser = { ...patient, userId: 8, roleId: 2 };

describe('Uas7Service', () => {
  const roleName = vi.fn();
  const patientExists = vi.fn();
  const doctorAssigned = vi.fn();
  const activeRecord = vi.fn();
  const recordForPatient = vi.fn();
  const create = vi.fn();
  const history = vi.fn();
  const week = vi.fn();
  let service: Uas7Service;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockImplementation((id: number) =>
      id === 3 ? 'patient' : 'doctor',
    );
    patientExists.mockResolvedValue(true);
    doctorAssigned.mockResolvedValue(true);
    activeRecord.mockResolvedValue(101);
    recordForPatient.mockResolvedValue('owned');
    service = new Uas7Service({
      roleName,
      patientExists,
      doctorAssigned,
      activeRecord,
      recordForPatient,
      create,
      history,
      week,
    } as unknown as Uas7Repository);
  });

  it('uses the signed-in patient and computes the daily score in the database', async () => {
    create.mockResolvedValue({
      patient_id: '15',
      medical_record_id: '101',
      score_date: '2026-10-08',
      iss7: '2',
      hss7: '1',
      daily_score: '3',
    });
    await expect(
      service.create(patient, {
        medical_record_id: '101',
        score_date: '2026-10-08',
        iss7: '2',
        hss7: 1,
        note: ' Ngứa đêm ',
      }),
    ).resolves.toMatchObject({
      code: '1001',
      data: { patient_id: '15', daily_score: '3' },
    });
    expect(create).toHaveBeenCalledWith({
      patientId: 15,
      recordId: 101,
      date: '2026-10-08',
      iss7: 2,
      hss7: 1,
      note: 'Ngứa đêm',
    });
  });

  it('allows a daily score without any visit', async () => {
    activeRecord.mockResolvedValue(null);
    create.mockResolvedValue({ patient_id: '15', medical_record_id: null });
    await expect(service.eligibility(patient)).resolves.toMatchObject({
      data: { eligible: 'true' },
    });
    await expect(
      service.create(patient, {
        score_date: '2026-10-08',
        iss7: 1,
        hss7: 0,
        patient_id: 99,
      }),
    ).resolves.toMatchObject({ code: '1001' });
    expect(create).toHaveBeenCalledWith({
      patientId: 15,
      recordId: null,
      date: '2026-10-08',
      iss7: 1,
      hss7: 0,
      note: null,
    });
    expect(activeRecord).not.toHaveBeenCalled();
  });
  it('rejects foreign records before writing a score', async () => {
    recordForPatient.mockResolvedValue('foreign');
    await expect(
      service.create(patient, {
        medical_record_id: '101',
        score_date: '2026-10-08',
        iss7: '2',
        hss7: '1',
      }),
    ).rejects.toMatchObject({ status: 403, response: { code: '3106' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects duplicate dates with the documented conflict code', async () => {
    create.mockRejectedValue({ code: '23505' });
    await expect(
      service.create(patient, {
        medical_record_id: 101,
        score_date: '2026-10-08',
        iss7: 0,
        hss7: 3,
      }),
    ).rejects.toMatchObject({ status: 409, response: { code: '5002' } });
  });

  it('rejects invalid calendar dates and scores', async () => {
    await expect(
      service.create(patient, {
        medical_record_id: 101,
        score_date: '2026-02-30',
        iss7: 1,
        hss7: 1,
      }),
    ).rejects.toMatchObject({ response: { code: '2006' } });
    await expect(
      service.create(patient, {
        medical_record_id: 101,
        score_date: '2026-10-08',
        iss7: 4,
        hss7: 1,
      }),
    ).rejects.toMatchObject({ response: { code: '5003' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('limits doctor access to assigned patients', async () => {
    doctorAssigned.mockResolvedValue(false);
    await expect(service.history(doctor, '15')).rejects.toMatchObject({
      status: 403,
      response: { code: '3105' },
    });
    expect(history).not.toHaveBeenCalled();
  });

  it('returns the weekly sum and severity for a seven-day window', async () => {
    week.mockResolvedValue({ week_score: '18', completed_days: '7' });
    await expect(
      service.week(patient, '15', '2026-10-02'),
    ).resolves.toMatchObject({
      code: '1000',
      data: {
        patient_id: '15',
        week_score: '18',
        completed_days: '7',
        severity_label: 'Nặng',
      },
    });
    expect(week).toHaveBeenCalledWith(15, '2026-10-02');
  });
});
