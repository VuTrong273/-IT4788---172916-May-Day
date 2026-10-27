import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';

const doctor: AuthenticatedUser = { userId: 3, roleId: 2, jti: 'test', expiresAt: 0 };
const otherDoctor: AuthenticatedUser = { ...doctor, userId: 4 };
const record = {
  medical_record_id: 12, patient_id: 2, assigned_doctor_id: null, created_by: 2,
  template_id: 'TPL_TEST', status: 'pending' as const, instructions: null,
  completed_at: null, created_at: new Date(), updated_at: new Date(),
};

describe('MedicalRecordsService', () => {
  const roleName = vi.fn();
  const list = vi.fn();
  const findById = vi.fn();
  const accept = vi.fn();
  const patientName = vi.fn();
  const activeTemplateExists = vi.fn();
  const patientExists = vi.fn();
  const create = vi.fn();
  const history = vi.fn();
  let service: MedicalRecordsService;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockResolvedValue('doctor');
    findById.mockResolvedValue(record);
    activeTemplateExists.mockResolvedValue(true);
    patientExists.mockResolvedValue(true);
    service = new MedicalRecordsService({ roleName, list, findById, accept, patientName,
      activeTemplateExists, patientExists, create, history } as unknown as MedicalRecordsRepository);
  });

  it('limits the doctor list to pending records and their own assignments', async () => {
    list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await service.list(doctor, { status: 'pending' });
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'pending', patientId: undefined, doctorId: 3 });
  });

  it('does not expose another doctor assigned record', async () => {
    findById.mockResolvedValue({ ...record, status: 'in_progress', assigned_doctor_id: 4 });
    await expect(service.get(doctor, '12')).rejects.toMatchObject({ status: 403, response: { code: '3105' } });
  });

  it('accepts a pending record through the conditional update', async () => {
    accept.mockResolvedValue({ medical_record_id: 12, assigned_doctor_id: 3, status: 'in_progress' });
    await expect(service.accept(doctor, '12')).resolves.toMatchObject({ data: { status: 'in_progress' } });
    expect(accept).toHaveBeenCalledWith(12, 3);
  });

  it('reports a race when another doctor accepted the record first', async () => {
    accept.mockResolvedValue(null);
    findById.mockResolvedValue({ ...record, status: 'in_progress', assigned_doctor_id: 4 });
    await expect(service.accept(doctor, '12')).rejects.toMatchObject({ status: 409, response: { code: '4005' } });
  });

  it('rejects accepting a record outside pending state', async () => {
    accept.mockResolvedValue(null);
    findById.mockResolvedValue({ ...record, status: 'in_progress', assigned_doctor_id: 3 });
    await expect(service.accept(doctor, '12')).rejects.toMatchObject({ status: 409, response: { code: '4004' } });
  });

  it('rejects invalid record IDs before database access', async () => {
    await expect(service.accept(otherDoctor, '0')).rejects.toMatchObject({ status: 400, response: { code: '2003' } });
    expect(accept).not.toHaveBeenCalled();
  });

  it('uses the authenticated patient ID, ignoring patient_id in the body', async () => {
    roleName.mockResolvedValue('patient');
    create.mockResolvedValue(record);
    await service.create({ ...doctor, userId: 2 }, { template_id: 'TPL_TEST', patient_id: 999 });
    expect(create).toHaveBeenCalledWith(2, 2, 'TPL_TEST');
  });

  it('rejects inactive or missing templates before creating a record', async () => {
    roleName.mockResolvedValue('patient');
    activeTemplateExists.mockResolvedValue(false);
    await expect(service.create({ ...doctor, userId: 2 }, { template_id: 'TPL_TEST' }))
      .rejects.toMatchObject({ status: 404, response: { code: '4101' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('prevents a patient reading another patient history', async () => {
    roleName.mockResolvedValue('patient');
    await expect(service.history({ ...doctor, userId: 2 }, '5'))
      .rejects.toMatchObject({ status: 403, response: { code: '3106' } });
    expect(history).not.toHaveBeenCalled();
  });
});
