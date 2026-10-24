import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/api/client';
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

export type MedicalRecordSummary = {
  medical_record_id: number;
  patient_name: string | null;
  status: MedicalRecordStatus;
  created_at: string;
};

type ApiResponse<T> = { code: string; message: string; data: T };
type ListResponse = ApiResponse<MedicalRecordListItem[]> & { total: number; page: number; limit: number };

function messageFor(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    const code = error.response?.data?.code;
    if (['3001', '3002', '3003'].includes(code ?? '')) return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    if (code === '4005') return new Error('Bệnh án đã được bác sĩ khác tiếp nhận.');
    if (code === '4004') return new Error('Bệnh án không còn ở trạng thái chờ.');
    if (code === '3105') return new Error('Bạn không được phân công bệnh án này.');
    if (code === '4001') return new Error('Không tìm thấy bệnh án.');
    return new Error(error.response?.data?.message || 'Không kết nối được backend. Hãy thử lại.');
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra. Hãy thử lại.');
}

async function request<T>(session: Session, path: string, method: 'get' | 'post' = 'get'): Promise<T> {
  if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
  try {
    const response = await apiClient.request<ApiResponse<T>>({
      url: path,
      method,
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.data.code !== '1000') throw new Error(response.data.message || 'Yêu cầu không thành công.');
    return response.data.data;
  } catch (error) {
    throw messageFor(error);
  }
}

export const medicalRecordsApi = {
  async list(session: Session, status: 'pending' | 'in_progress', page = 1): Promise<ListResponse> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<ListResponse>('/medical_records/all', {
        params: { status, page, limit: 20 },
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (response.data.code !== '1000') throw new Error(response.data.message || 'Không tải được bệnh án.');
      return response.data;
    } catch (error) {
      throw messageFor(error);
    }
  },
  get: (session: Session, id: number) => request<MedicalRecord>(session, `/medical_records/${id}`),
  summary: (session: Session, id: number) => request<MedicalRecordSummary>(session, `/medical_records/${id}/summary`),
  accept: (session: Session, id: number) => request<Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'>>(
    session, `/medical_records/${id}/accept`, 'post'),
};
