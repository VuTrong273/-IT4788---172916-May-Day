import {
  apiRequest,
  ApiRequestError,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type MedicalRecordStatus = 'pending' | 'in_progress' | 'completed';

export type MedicalRecordListItem = {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  template_id: string;
  status: MedicalRecordStatus;
  created_at: string;
};

export type MedicalRecord = MedicalRecordListItem & {
  created_by: number | null;
  instructions: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type CreatedMedicalRecord = Pick<
  MedicalRecord,
  'medical_record_id' | 'patient_id' | 'assigned_doctor_id' | 'created_by' | 'template_id' | 'status' | 'instructions' | 'created_at'
>;

export type MedicalRecordSummary = {
  medical_record_id: number;
  patient_name: string | null;
  status: MedicalRecordStatus;
  created_at: string;
};

export type PatientHistoryItem = {
  medical_record_id: number;
  status: MedicalRecordStatus;
  instructions: string | null;
  created_at: string;
};

export type ClassificationQuestion = {
  question_id: string;
  question_text: string;
  type_question: string;
  options: { id: number; option_text: string; option_value: string }[];
};

export type MedicalRecordAnswer = {
  id: number;
  medical_record_id: number;
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown | null;
  answered_by: number | null;
  created_at: string;
  updated_at: string;
};

export type AnswerInput = {
  question_id: string;
  question_option_id?: number | null;
  answer_text?: string | null;
  answer_value?: unknown | null;
};

export type TemplateQuestion = {
  question_id: string;
  question_text: string;
  type_question: 'text' | 'textarea' | 'number' | 'date' | 'radio' | 'checkbox' | 'select' | 'image' | string;
  placeholder: string | null;
  help_text: string | null;
  order: number;
  is_required: number;
  allow_image: number;
  parent_question_id: string | null;
  show_if_answer: string | null;
  condition_rules: string | null;
  options: {
    id: number;
    option_text: string;
    option_value: string;
    order: number;
    trigger_image_upload: number;
  }[];
};

export type MedicalRecordTemplate = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: string;
  sections: {
    section_id: number;
    title: string;
    order: number;
    is_required: number;
    filled_by: 'patient' | 'doctor' | 'patdoc';
    questions: TemplateQuestion[];
  }[];
};

export type ListResponse = ApiEnvelope<MedicalRecordListItem[]> & {
  total: number;
  page: number;
  limit: number;
};

function messageFor(error: unknown): Error {
  if (error instanceof ApiRequestError) {
    let message: string | undefined;
    if (['3001', '3002', '3003'].includes(error.apiCode ?? '') || error.status === 401) {
      message = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
    } else if (error.apiCode === '4005') {
      message = 'Bệnh án đã được bác sĩ khác tiếp nhận.';
    } else if (error.apiCode === '4004') {
      message = 'Bệnh án không còn ở trạng thái chờ.';
    } else if (error.apiCode === '3105') {
      message = 'Bạn không được phân công bệnh án này.';
    } else if (error.apiCode === '3106') {
      message = 'Bạn không có quyền truy cập bệnh án này.';
    } else if (error.apiCode === '4001') {
      message = 'Không tìm thấy bệnh án.';
    } else if (error.apiCode === '4003') {
      message = 'Bệnh án đã hoàn tất và không thể sửa.';
    } else if (error.apiCode === '4006') {
      message = 'Vui lòng trả lời đầy đủ câu hỏi phân loại.';
    } else if (error.apiCode === '4007') {
      message = 'Cần có ít nhất một câu trả lời.';
    } else if (error.apiCode === '4008') {
      message = 'Câu hỏi không thuộc mẫu phiếu của bệnh án.';
    } else if (error.apiCode === '4101') {
      message = 'Không tìm thấy mẫu phiếu phù hợp.';
    }

    if (message) {
      return new ApiRequestError({
        kind: error.kind,
        status: error.status,
        apiCode: error.apiCode,
        operation: error.operation,
        retryable: error.retryable,
        message,
      });
    }
    return error;
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra. Hãy thử lại.');
}

async function request<T>(
  session: Session,
  path: string,
  method: 'get' | 'post' | 'put' | 'delete' = 'get',
  data?: object,
  acceptedCodes: readonly string[] = ['1000'],
): Promise<T> {
  try {
    const response = await apiRequest<ApiEnvelope<T>>(
      { url: path, method, data },
      session.token,
    );
    return requireApiCode(response, acceptedCodes, `${method.toUpperCase()} ${path}`).data;
  } catch (error) {
    throw messageFor(error);
  }
}

export const medicalRecordsApi = {
  getClassificationQuestions: (session: Session) =>
    request<ClassificationQuestion[]>(session, '/medical_records/classify-questions'),

  classify: (session: Session, answers: { question_id: string; option_value: string }[]) =>
    request<{ template_id: string; template_name: string }>(
      session,
      '/medical_records/classify',
      'post',
      { answers },
    ),

  create: (
    session: Session,
    input: { template_id: string; patient_id?: number; answers?: AnswerInput[] },
  ) => request<CreatedMedicalRecord>(session, '/medical_records', 'post', input, ['1001']),

  async list(
    session: Session,
    filters: {
      status?: MedicalRecordStatus;
      page?: number;
      limit?: number;
      patient_id?: number;
    } = {},
  ): Promise<ListResponse> {
    try {
      const response = await apiRequest<ListResponse>(
        {
          method: 'get',
          url: '/medical_records/all',
          params: {
            page: filters.page ?? 1,
            limit: filters.limit ?? 20,
            status: filters.status,
            patient_id: filters.patient_id,
          },
        },
        session.token,
      );
      return requireApiCode(response, ['1000'], 'GET /medical_records/all');
    } catch (error) {
      throw messageFor(error);
    }
  },

  get: (session: Session, id: number) =>
    request<MedicalRecord>(session, `/medical_records/${id}`),

  summary: (session: Session, id: number) =>
    request<MedicalRecordSummary>(session, `/medical_records/${id}/summary`),

  history: (session: Session, patientId: number) =>
    request<PatientHistoryItem[]>(session, `/medical_records/patients/${patientId}/history`),

  accept: (session: Session, id: number) =>
    request<Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'>>(
      session,
      `/medical_records/${id}/accept`,
      'post',
    ),

  complete: (session: Session, id: number, instructions?: string) =>
    request<MedicalRecord>(
      session,
      `/medical_records/${id}`,
      'put',
      { status: 'completed', ...(instructions?.trim() ? { instructions: instructions.trim() } : {}) },
    ),

  delete: (session: Session, id: number) =>
    request<Record<string, never>>(session, `/medical_records/${id}`, 'delete'),

  answers: (session: Session, id: number) =>
    request<MedicalRecordAnswer[]>(session, `/medical_records/${id}/answers`),

  saveAnswers: (session: Session, id: number, answers: AnswerInput[]) => {
    const hasValue = (answer: AnswerInput) =>
      answer.question_option_id !== undefined && answer.question_option_id !== null ||
      answer.answer_text !== undefined && answer.answer_text !== null && answer.answer_text !== '' ||
      answer.answer_value !== undefined && answer.answer_value !== null;
    if (!answers.length || answers.some((answer) => !answer.question_id.trim() || !hasValue(answer))) {
      throw new ApiRequestError({
        kind: 'api',
        operation: `PUT /medical_records/${id}/answers`,
        apiCode: '4007',
        message: 'Hãy nhập ít nhất một câu trả lời trước khi lưu.',
      });
    }
    return request<{ count: number }>(
      session,
      `/medical_records/${id}/answers`,
      'put',
      { answers },
    );
  },

  template: (session: Session, templateId: string) =>
    request<MedicalRecordTemplate>(session, `/templates/${encodeURIComponent(templateId)}`),
};
