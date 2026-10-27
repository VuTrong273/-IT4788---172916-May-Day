import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ClinicalOrdersRepository } from './clinical-orders.repository.js';
import { ClinicalOrdersService } from './clinical-orders.service.js';

const doctor: AuthenticatedUser = { userId: 8, roleId: 2, jti: 'test', expiresAt: 0 };
const patient: AuthenticatedUser = { ...doctor, userId: 15, roleId: 3 };
const record = {
  medical_record_id: 101,
  patient_id: 15,
  assigned_doctor_id: 8,
  status: 'in_progress' as const,
};

describe('ClinicalOrdersService', () => {
  const roleName = vi.fn();
  const recordAccess = vi.fn();
  const createPrescription = vi.fn();
  const getPrescription = vi.fn();
  const createLabRequest = vi.fn();
  const listLabRequests = vi.fn();
  const labRequestRecordId = vi.fn();
  const enterLabResults = vi.fn();
  let service: ClinicalOrdersService;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockResolvedValue('doctor');
    recordAccess.mockResolvedValue(record);
    labRequestRecordId.mockResolvedValue(101);
    service = new ClinicalOrdersService({
      roleName,
      recordAccess,
      createPrescription,
      getPrescription,
      createLabRequest,
      listLabRequests,
      labRequestRecordId,
      enterLabResults,
    } as unknown as ClinicalOrdersRepository);
  });

  it('creates a prescription for the assigned doctor and formats IDs as strings', async () => {
    createPrescription.mockResolvedValue({
      prescription_id: 3,
      medical_record_id: 101,
      created_by: 8,
      note: null,
      items: [{
        prescription_item_id: 6,
        medicine_name: 'Cetirizine 10mg',
        dosage: '1 viên',
        frequency: '1 lần/ngày',
        duration: '7 ngày',
        instruction: null,
      }],
      created_at: new Date('2026-10-08T09:30:00Z'),
    });

    await expect(service.createPrescription(doctor, {
      medical_record_id: '101',
      items: [{ medicine_name: 'Cetirizine 10mg', dosage: '1 viên', frequency: '1 lần/ngày', duration: '7 ngày' }],
    })).resolves.toMatchObject({
      code: '1001',
      data: { prescription_id: '3', medical_record_id: '101', items: [{ prescription_item_id: '6' }] },
    });
    expect(createPrescription).toHaveBeenCalledWith({
      recordId: 101,
      doctorId: 8,
      note: null,
      items: [{
        medicine_name: 'Cetirizine 10mg',
        dosage: '1 viên',
        frequency: '1 lần/ngày',
        duration: '7 ngày',
        instruction: null,
      }],
    });
  });

  it('rejects prescriptions with missing required medicine fields', async () => {
    await expect(service.createPrescription(doctor, {
      medical_record_id: '101',
      items: [{ medicine_name: 'Cetirizine' }],
    })).rejects.toMatchObject({ response: { code: '8002' } });
    expect(createPrescription).not.toHaveBeenCalled();
  });

  it('reports the unique prescription-per-record conflict', async () => {
    createPrescription.mockRejectedValue({ code: '23505' });
    await expect(service.createPrescription(doctor, {
      medical_record_id: '101',
      items: [{ medicine_name: 'A', dosage: '1', frequency: 'daily', duration: '1 day' }],
    })).rejects.toMatchObject({ status: 409, response: { code: '8003' } });
  });

  it('does not allow a doctor to write to another doctor’s record', async () => {
    recordAccess.mockResolvedValue({ ...record, assigned_doctor_id: 9 });
    await expect(service.createLabRequest(doctor, {
      medical_record_id: '101',
      items: [{ test_name: 'CBC' }],
    })).rejects.toMatchObject({ status: 403, response: { code: '3105' } });
    expect(createLabRequest).not.toHaveBeenCalled();
  });

  it('creates lab requests with one or more valid tests', async () => {
    createLabRequest.mockResolvedValue({
      lab_request_id: 2,
      medical_record_id: 101,
      requested_by: 8,
      status: 'pending',
      note: null,
      items: [{ lab_request_item_id: 4, test_name: 'CBC', description: null, lab_result_id: null, result_value: null, concluded_by: null, result_note: null }],
      created_at: new Date('2026-10-08T09:30:00Z'),
    });
    await expect(service.createLabRequest(doctor, {
      medical_record_id: '101',
      items: [{ test_name: 'CBC' }],
    })).resolves.toMatchObject({
      code: '1001',
      data: { id: '2', medical_record_id: '101', status: 'pending', items: [{ id: '4', result_value: null }] },
    });
  });

  it('requires at least one test in a lab request', async () => {
    await expect(service.createLabRequest(doctor, {
      medical_record_id: '101',
      items: [],
    })).rejects.toMatchObject({ status: 400, response: { code: '8101' } });
    expect(createLabRequest).not.toHaveBeenCalled();
  });

  it('lets the owning patient read their own prescription', async () => {
    roleName.mockResolvedValue('patient');
    getPrescription.mockResolvedValue({
      prescription_id: 3,
      medical_record_id: 101,
      created_by: 8,
      note: null,
      items: [],
      created_at: new Date('2026-10-08T09:30:00Z'),
    });
    await expect(service.getPrescription(patient, '101'))
      .resolves.toMatchObject({ data: { medical_record_id: '101' } });
  });

  it('rejects a patient trying to read another patient’s lab results', async () => {
    roleName.mockResolvedValue('patient');
    recordAccess.mockResolvedValue({ ...record, patient_id: 99 });
    await expect(service.listLabResults(patient, '101'))
      .rejects.toMatchObject({ status: 403, response: { code: '3106' } });
    expect(listLabRequests).not.toHaveBeenCalled();
  });

  it('only accepts lab results for items in the matching request', async () => {
    enterLabResults.mockResolvedValue({ invalidItem: true });
    await expect(service.enterLabResults(doctor, {
      lab_request_id: '2',
      results: [{ lab_request_item_id: '777', result_value: 'Normal' }],
    })).rejects.toMatchObject({ status: 400, response: { code: '2003' } });
  });

  it('saves entered results for the assigned doctor', async () => {
    enterLabResults.mockResolvedValue({
      lab_request_id: 2,
      medical_record_id: 101,
      requested_by: 8,
      status: 'completed',
      note: null,
      items: [{
        lab_request_item_id: 4,
        test_name: 'CBC',
        description: null,
        lab_result_id: 5,
        result_value: 'Normal',
        concluded_by: 8,
        result_note: null,
      }],
      created_at: new Date('2026-10-08T09:30:00Z'),
    });

    await expect(service.enterLabResults(doctor, {
      lab_request_id: '2',
      results: [{ lab_request_item_id: '4', result_value: 'Normal' }],
    })).resolves.toMatchObject({
      code: '1001',
      data: { id: '2', status: 'completed', items: [{ id: '4', result_value: 'Normal' }] },
    });
    expect(enterLabResults).toHaveBeenCalledWith({
      requestId: 2,
      doctorId: 8,
      results: [{ itemId: 4, resultValue: 'Normal', resultNote: null }],
    });
  });
});
