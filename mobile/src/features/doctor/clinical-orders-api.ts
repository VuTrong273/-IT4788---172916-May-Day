import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/api/client';
import type { Session } from '@/features/auth/session';
import type { MedicalRecordListItem } from './medical-records-api';

export type PrescriptionItem = {
  prescription_item_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string | null;
};

export type Prescription = {
  prescription_id: string;
  medical_record_id: string;
  created_by: string | null;
  note: string | null;
  items: PrescriptionItem[];
  created_at: string;
};

export type LabResultItem = {
  id: string;
  test_name: string;
  description?: string | null;
  result_id: string | null;
  result_value: string | null;
  concluded_by: string | null;
  result_note: string | null;
};

export type LabRequest = {
  id: string;
  medical_record_id?: string;
  requested_by: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  note: string | null;
  items: LabResultItem[];
  created_at: string;
};

type ApiResponse<T> = { code: string; message: string; data: T };

function requestError(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    const code = error.response?.data?.code;
    if (['3001', '3002', '3003'].includes(code ?? '')) {
      return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    }
    if (code === '3105') return new Error('Lần khám không được phân công cho bạn.');
    if (code === '4001') return new Error('Không tìm thấy lần khám.');
    if (code === '8003') return new Error('Lần khám này đã có đơn thuốc.');
    if (code === '2008') return new Error('Lần khám chưa có đơn thuốc.');
    if (code === '8103') return new Error('Không tìm thấy phiếu xét nghiệm.');
    return new Error(error.response?.data?.message || 'Không kết nối được backend. Hãy thử lại.');
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra. Hãy thử lại.');
}

async function request<T>(
  session: Session,
  path: string,
  method: 'get' | 'post',
  body?: object,
  successCode = '1000',
): Promise<T> {
  if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
  try {
    const response = await apiClient.request<ApiResponse<T>>({
      url: path,
      method,
      data: body,
      headers: { Authorization: ['Bearer', session.token].join(' ') },
    });
    if (response.data.code !== successCode) {
      throw new Error(response.data.message || 'Yêu cầu không thành công.');
    }
    return response.data.data;
  } catch (error) {
    throw requestError(error);
  }
}

export const clinicalOrdersApi = {
  async activeRecords(session: Session): Promise<MedicalRecordListItem[]> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<ApiResponse<MedicalRecordListItem[]> & { total: number }>(
        '/medical_records/all',
        {
          params: { status: 'in_progress', page: 1, limit: 100 },
          headers: { Authorization: ['Bearer', session.token].join(' ') },
        },
      );
      if (response.data.code !== '1000') throw new Error('Không tải được lần khám.');
      return response.data.data;
    } catch (error) {
      throw requestError(error);
    }
  },

  labRequests: (session: Session, recordId: number) =>
    request<LabRequest[]>(session, `/lab-results/${recordId}`, 'get'),

  async prescription(session: Session, recordId: number): Promise<Prescription | null> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<ApiResponse<Prescription>>(`/prescriptions/${recordId}`, {
        headers: { Authorization: ['Bearer', session.token].join(' ') },
      });
      if (response.data.code !== '1000') {
        throw new Error(response.data.message || 'Không tải được đơn thuốc.');
      }
      return response.data.data;
    } catch (error) {
      if (isAxiosError<{ code?: string }>(error) && error.response?.data?.code === '2008') return null;
      throw requestError(error);
    }
  },

  createLabRequest: (
    session: Session,
    input: { medical_record_id: string; note: string; items: { test_name: string; description?: string }[] },
  ) => request<LabRequest>(session, '/lab-requests', 'post', input, '1001'),

  enterLabResults: (
    session: Session,
    input: {
      lab_request_id: string;
      results: { lab_request_item_id: string; result_value: string; result_note?: string }[];
    },
  ) => request<LabRequest>(session, '/lab-results', 'post', input, '1001'),

  createPrescription: (
    session: Session,
    input: {
      medical_record_id: string;
      note?: string;
      items: {
        medicine_name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instruction?: string;
      }[];
    },
  ) => request<Prescription>(session, '/prescriptions', 'post', input, '1001'),
};
