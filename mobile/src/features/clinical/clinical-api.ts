import {
  apiRequest,
  ApiRequestError,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type PrescriptionItemInput = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction?: string | null;
};

export type PrescriptionItem = {
  prescription_item_id: string;
  medicine_name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instruction?: string | null;
};

export type Prescription = {
  prescription_id: string;
  medical_record_id: string;
  created_by?: string;
  note?: string | null;
  items: PrescriptionItem[];
  created_at?: string;
};

export type LabRequestItemInput = {
  test_name: string;
  description?: string | null;
};

export type LabRequestItem = LabRequestItemInput & {
  id: string;
};

export type LabRequest = {
  id: string;
  medical_record_id: string;
  requested_by?: string;
  status: 'pending' | 'in_progress' | 'completed';
  note?: string | null;
  items: LabRequestItem[];
  created_at?: string;
};

export type LabResultItem = {
  id: string;
  test_name: string;
  result_id?: string | null;
  result_value?: string | null;
  concluded_by?: string | null;
  result_note?: string | null;
};

export type LabRequestWithResults = {
  id: string;
  requested_by?: string;
  status: 'pending' | 'in_progress' | 'completed';
  note?: string | null;
  items: LabResultItem[];
  created_at?: string;
};

export type LabResultInput = {
  lab_request_item_id: string;
  result_value: string;
  result_note?: string | null;
};

async function request<T>(
  session: Session,
  path: string,
  method: 'get' | 'post',
  data?: object,
  acceptedCodes: readonly string[] = ['1000'],
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { url: path, method, data },
    session.token,
  );
  return requireApiCode(response, acceptedCodes, `${method.toUpperCase()} ${path}`).data;
}

function assertRecordId(recordId: number) {
  if (!Number.isSafeInteger(recordId) || recordId < 1) {
    throw new ApiRequestError({
      kind: 'api',
      operation: 'clinical record validation',
      apiCode: '2001',
      message: 'Mã bệnh án phải là số nguyên dương.',
    });
  }
}

function assertNonEmptyText(value: string, label: string) {
  if (!value.trim()) {
    throw new ApiRequestError({
      kind: 'api',
      operation: 'clinical input validation',
      apiCode: '2001',
      message: `${label} không được để trống.`,
    });
  }
}

export const clinicalApi = {
  createPrescription(
    session: Session,
    recordId: number,
    input: { note?: string; items: PrescriptionItemInput[] },
  ) {
    assertRecordId(recordId);
    if (!input.items.length) {
      throw new ApiRequestError({
        kind: 'api',
        operation: 'POST /prescriptions',
        apiCode: '8001',
        message: 'Đơn thuốc cần ít nhất một loại thuốc.',
      });
    }
    for (const [index, item] of input.items.entries()) {
      for (const field of ['medicine_name', 'dosage', 'frequency', 'duration'] as const) {
        assertNonEmptyText(item[field], `Thuốc ${index + 1}: ${field}`);
      }
    }
    return request<Prescription>(
      session,
      '/prescriptions',
      'post',
      {
        medical_record_id: String(recordId),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        items: input.items.map((item) => ({
          medicine_name: item.medicine_name.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          ...(item.instruction?.trim() ? { instruction: item.instruction.trim() } : {}),
        })),
      },
      ['1001'],
    );
  },

  async getPrescription(session: Session, recordId: number): Promise<Prescription | null> {
    assertRecordId(recordId);
    try {
      return await request<Prescription>(
        session,
        `/prescriptions/${recordId}`,
        'get',
      );
    } catch (error) {
      // The contract defines 2008 as the record having no prescription yet.
      if (error instanceof ApiRequestError && error.apiCode === '2008') return null;
      throw error;
    }
  },

  createLabRequest(
    session: Session,
    recordId: number,
    input: { note?: string; items: LabRequestItemInput[] },
  ) {
    assertRecordId(recordId);
    if (!input.items.length) {
      throw new ApiRequestError({
        kind: 'api',
        operation: 'POST /lab-requests',
        apiCode: '8101',
        message: 'Phiếu chỉ định cần ít nhất một xét nghiệm.',
      });
    }
    input.items.forEach((item, index) => assertNonEmptyText(item.test_name, `Xét nghiệm ${index + 1}`));
    return request<LabRequest>(
      session,
      '/lab-requests',
      'post',
      {
        medical_record_id: String(recordId),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        items: input.items.map((item) => ({
          test_name: item.test_name.trim(),
          ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        })),
      },
      ['1001'],
    );
  },

  listLabResults(session: Session, recordId: number) {
    assertRecordId(recordId);
    return request<LabRequestWithResults[]>(
      session,
      `/lab-results/${recordId}`,
      'get',
    );
  },

  enterLabResults(
    session: Session,
    input: { lab_request_id: string; results: LabResultInput[] },
  ) {
    assertNonEmptyText(input.lab_request_id, 'Mã phiếu xét nghiệm');
    if (!/^\d+$/.test(input.lab_request_id)) {
      throw new ApiRequestError({
        kind: 'api',
        operation: 'POST /lab-results',
        apiCode: '2001',
        message: 'Mã phiếu xét nghiệm phải là số nguyên dạng chuỗi.',
      });
    }
    if (!input.results.length) {
      throw new ApiRequestError({
        kind: 'api',
        operation: 'POST /lab-results',
        apiCode: '2001',
        message: 'Nhập ít nhất một kết quả xét nghiệm trước khi lưu.',
      });
    }
    input.results.forEach((result, index) => {
      assertNonEmptyText(result.lab_request_item_id, `Mã xét nghiệm ${index + 1}`);
      assertNonEmptyText(result.result_value, `Kết quả xét nghiệm ${index + 1}`);
    });
    return request<LabRequestWithResults>(
      session,
      '/lab-results',
      'post',
      {
        lab_request_id: input.lab_request_id,
        results: input.results.map((result) => ({
          lab_request_item_id: result.lab_request_item_id,
          result_value: result.result_value.trim(),
          ...(result.result_note?.trim() ? { result_note: result.result_note.trim() } : {}),
        })),
      },
      ['1001'],
    );
  },
};
