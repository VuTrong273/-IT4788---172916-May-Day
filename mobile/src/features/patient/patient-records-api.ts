import { isAxiosError } from 'axios';

import { apiClient, apiUrl } from '@/api/client';
import type { Session } from '@/features/auth/session';
import type { MedicalRecord } from '@/features/doctor/medical-records-api';

export type ActiveTemplate = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: '1';
};

export type PatientRecord = Pick<MedicalRecord, 'medical_record_id' | 'status' | 'instructions' | 'created_at'>;

function requestError(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    const code = error.response?.data?.code;
    if (['3001', '3002', '3003'].includes(code ?? '')) return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    if (code === '4101') return new Error('Mẫu phiếu này không còn hoạt động. Hãy tải lại danh sách.');
    return new Error(error.response?.data?.message || 'Không kết nối được backend. Hãy thử lại.');
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra. Hãy thử lại.');
}

function headers(session: Session) { return { Authorization: `Bearer ${session.token}` }; }

export const patientRecordsApi = {
  async activeTemplates(session: Session): Promise<ActiveTemplate[]> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<{ code: string; data: ActiveTemplate[] }>('/templates/all', {
        params: { is_active: '1', page: 1, limit: 100 }, headers: headers(session),
      });
      if (response.data.code !== '1000') throw new Error('Không tải được mẫu phiếu.');
      return response.data.data;
    } catch (error) { throw requestError(error); }
  },

  async create(session: Session, templateId: string): Promise<MedicalRecord> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.post<{ code: string; data: MedicalRecord }>('/medical_records',
        { template_id: templateId }, { headers: headers(session) });
      if (response.data.code !== '1001') throw new Error('Không tạo được bệnh án.');
      return response.data.data;
    } catch (error) { throw requestError(error); }
  },

  async history(session: Session): Promise<PatientRecord[]> {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.get<{ code: string; data: PatientRecord[] }>(
        `/medical_records/patients/${session.user.user_id}/history`, { headers: headers(session) });
      if (response.data.code !== '1000') throw new Error('Không tải được bệnh án.');
      return response.data.data;
    } catch (error) { throw requestError(error); }
  },
};
