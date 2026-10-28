import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';

const doctor: AuthenticatedUser = {
  userId: 3,
  roleId: 2,
  jti: 'test',
  expiresAt: 0,
};
const otherDoctor: AuthenticatedUser = { ...doctor, userId: 4 };
const record = {
  medical_record_id: 12,
  patient_id: 2,
  assigned_doctor_id: null,
  created_by: 2,
  template_id: 'TPL_TEST',
  status: 'pending' as const,
  instructions: null,
  completed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
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
  const questionsForTemplate = vi.fn();
  const answers = vi.fn();
  const upsertAnswers = vi.fn();
  const complete = vi.fn();
  let service: MedicalRecordsService;

  beforeEach(() => {
    vi.resetAllMocks();
    roleName.mockResolvedValue('doctor');
    findById.mockResolvedValue(record);
    activeTemplateExists.mockResolvedValue(true);
    patientExists.mockResolvedValue(true);
    questionsForTemplate.mockResolvedValue([]);
    service = new MedicalRecordsService({
      roleName,
      list,
      findById,
      accept,
      patientName,
      activeTemplateExists,
      patientExists,
      create,
      history,
      questionsForTemplate,
      answers,
      upsertAnswers,
      complete,
    } as unknown as MedicalRecordsRepository);
  });

  it('limits the doctor list to pending records and their own assignments', async () => {
    list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await service.list(doctor, { status: 'pending' });
    expect(list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'pending',
      patientId: undefined,
      doctorId: 3,
    });
  });

  it('creates a pending record for the selected patient with the doctor as creator', async () => {
    create.mockResolvedValue({
      ...record,
      patient_id: 27,
      created_by: doctor.userId,
    });
    await expect(
      service.create(doctor, { patient_id: 27, template_id: 'TPL_TEST' }),
    ).resolves.toMatchObject({
      code: '1001',
      data: { patient_id: 27, created_by: doctor.userId, status: 'pending' },
    });
    expect(create).toHaveBeenCalledWith(27, doctor.userId, 'TPL_TEST', []);
    expect(accept).not.toHaveBeenCalled();
  });

  it.each([
    [{ template_id: 'TPL_TEST' }, '2001'],
    [{ template_id: 'TPL_TEST', patient_id: '27' }, '2002'],
    [{ template_id: 'TPL_TEST', patient_id: 0 }, '2003'],
  ])(
    'rejects a doctor request with missing or invalid patient %#',
    async (body, code) => {
      await expect(service.create(doctor, body)).rejects.toMatchObject({
        status: 400,
        response: { code },
      });
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('rejects creation when the chosen template is no longer active', async () => {
    activeTemplateExists.mockResolvedValue(false);
    await expect(
      service.create(doctor, { patient_id: 27, template_id: 'TPL_TEST' }),
    ).rejects.toMatchObject({ status: 404, response: { code: '4101' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects creation for a patient that no longer exists', async () => {
    patientExists.mockResolvedValue(false);
    await expect(
      service.create(doctor, { patient_id: 27, template_id: 'TPL_TEST' }),
    ).rejects.toMatchObject({ status: 400, response: { code: '2003' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not expose another doctor assigned record', async () => {
    findById.mockResolvedValue({
      ...record,
      status: 'in_progress',
      assigned_doctor_id: 4,
    });
    await expect(service.get(doctor, '12')).rejects.toMatchObject({
      status: 403,
      response: { code: '3105' },
    });
  });

  it('accepts a pending record through the conditional update', async () => {
    accept.mockResolvedValue({
      medical_record_id: 12,
      assigned_doctor_id: 3,
      status: 'in_progress',
    });
    await expect(service.accept(doctor, '12')).resolves.toMatchObject({
      data: { status: 'in_progress' },
    });
    expect(accept).toHaveBeenCalledWith(12, 3);
  });

  it('reports a race when another doctor accepted the record first', async () => {
    accept.mockResolvedValue(null);
    findById.mockResolvedValue({
      ...record,
      status: 'in_progress',
      assigned_doctor_id: 4,
    });
    await expect(service.accept(doctor, '12')).rejects.toMatchObject({
      status: 409,
      response: { code: '4005' },
    });
  });

  it('rejects accepting a record outside pending state', async () => {
    accept.mockResolvedValue(null);
    findById.mockResolvedValue({
      ...record,
      status: 'in_progress',
      assigned_doctor_id: 3,
    });
    await expect(service.accept(doctor, '12')).rejects.toMatchObject({
      status: 409,
      response: { code: '4004' },
    });
  });

  it('rejects invalid record IDs before database access', async () => {
    await expect(service.accept(otherDoctor, '0')).rejects.toMatchObject({
      status: 400,
      response: { code: '2003' },
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('uses the authenticated patient ID, ignoring patient_id in the body', async () => {
    roleName.mockResolvedValue('patient');
    create.mockResolvedValue(record);
    await service.create(
      { ...doctor, userId: 2 },
      { template_id: 'TPL_TEST', patient_id: 999 },
    );
    expect(create).toHaveBeenCalledWith(2, 2, 'TPL_TEST', []);
  });

  it('creates a record and its initial answers from the same validated request', async () => {
    roleName.mockResolvedValue('patient');
    create.mockResolvedValue(record);
    questionsForTemplate.mockResolvedValue([
      {
        question_id: 'Q_SYMPTOM',
        section_id: 1,
        filled_by: 'patient',
        type_question: 'radio',
        is_required: 1,
        options: [{ id: 21, option_value: 'yes' }],
      },
    ]);
    await service.create(
      { ...doctor, userId: 2 },
      {
        template_id: 'TPL_TEST',
        answers: [{ question_id: 'Q_SYMPTOM', question_option_id: 21 }],
      },
    );
    expect(create).toHaveBeenCalledWith(2, 2, 'TPL_TEST', [
      {
        question_id: 'Q_SYMPTOM',
        question_option_id: 21,
        answer_text: null,
        answer_value: null,
      },
    ]);
  });

  it('rejects inactive or missing templates before creating a record', async () => {
    roleName.mockResolvedValue('patient');
    activeTemplateExists.mockResolvedValue(false);
    await expect(
      service.create({ ...doctor, userId: 2 }, { template_id: 'TPL_TEST' }),
    ).rejects.toMatchObject({ status: 404, response: { code: '4101' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('prevents a patient reading another patient history', async () => {
    roleName.mockResolvedValue('patient');
    await expect(
      service.history({ ...doctor, userId: 2 }, '5'),
    ).rejects.toMatchObject({ status: 403, response: { code: '3106' } });
    expect(history).not.toHaveBeenCalled();
  });

  it('saves only answers that belong to questions in the record template', async () => {
    roleName.mockResolvedValue('patient');
    questionsForTemplate.mockResolvedValue([
      {
        question_id: 'Q_SYMPTOM',
        section_id: 1,
        filled_by: 'patient',
        type_question: 'radio',
        is_required: 1,
        options: [{ id: 21, option_value: 'yes' }],
      },
    ]);
    upsertAnswers.mockResolvedValue({ count: 1 });
    await expect(
      service.upsertAnswers({ ...doctor, userId: 2 }, '12', {
        answers: [{ question_id: 'Q_SYMPTOM', question_option_id: 21 }],
      }),
    ).resolves.toMatchObject({ data: { count: 1 } });
    expect(upsertAnswers).toHaveBeenCalledWith(12, 2, [
      {
        question_id: 'Q_SYMPTOM',
        question_option_id: 21,
        answer_text: null,
        answer_value: null,
      },
    ]);
  });

  it('rejects an option that belongs to another question', async () => {
    roleName.mockResolvedValue('patient');
    questionsForTemplate.mockResolvedValue([
      {
        question_id: 'Q_SYMPTOM',
        section_id: 1,
        filled_by: 'patient',
        type_question: 'radio',
        is_required: 1,
        options: [{ id: 21, option_value: 'yes' }],
      },
    ]);
    await expect(
      service.upsertAnswers({ ...doctor, userId: 2 }, '12', {
        answers: [{ question_id: 'Q_SYMPTOM', question_option_id: 999 }],
      }),
    ).rejects.toMatchObject({ status: 400, response: { code: '4008' } });
    expect(upsertAnswers).not.toHaveBeenCalled();
  });

  it('completes only a record assigned to the requesting doctor', async () => {
    findById.mockResolvedValue({
      ...record,
      assigned_doctor_id: 3,
      status: 'in_progress',
    });
    complete.mockResolvedValue({
      ...record,
      assigned_doctor_id: 3,
      status: 'completed',
    });
    await expect(
      service.complete(doctor, '12', {
        status: 'completed',
        instructions: 'Follow up',
      }),
    ).resolves.toMatchObject({ data: { status: 'completed' } });
    expect(complete).toHaveBeenCalledWith(12, 3, 'Follow up');
  });
});
