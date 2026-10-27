import { isAxiosError } from 'axios';
import { apiClient, apiUrl } from '@/api/client';
import type { Session } from '@/features/auth/session';

export type Uas7Eligibility =
  | { eligible: 'false' }
  | { eligible: 'true'; medical_record_id: string };

export type Uas7Entry = {
  patient_id: string;
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note: string | null;
};

export type Uas7Week = {
  patient_id: string;
  week_score: string;
  severity_label: string;
  completed_days: string;
};

function auth(session: Session) {
  return { Authorization: `Bearer ${session.token}` };
}

function apiError(error: unknown): Error {
  if (isAxiosError<{ code?: string; message?: string }>(error)) {
    switch (error.response?.data?.code) {
      case '5001': return new Error('Bạn cần có bệnh án đang khám để chấm UAS7.');
      case '5002': return new Error('Bạn đã chấm UAS7 cho ngày này.');
      case '3001': case '3002': case '3003':
        return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
      default: return new Error(error.response?.data?.message || 'Không kết nối được backend.');
    }
  }
  return error instanceof Error ? error : new Error('Có lỗi xảy ra.');
}

async function getData<T>(path: string, session: Session): Promise<T> {
  if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
  try {
    const response = await apiClient.get<{ code: string; data: T }>(path, { headers: auth(session) });
    if (response.data.code !== '1000') throw new Error('Không tải được dữ liệu UAS7.');
    return response.data.data;
  } catch (error) { throw apiError(error); }
}

export const uas7Api = {
  eligibility: (session: Session) => getData<Uas7Eligibility>('/uas7-scores/eligibility', session),
  history: (session: Session) => getData<Uas7Entry[]>(`/uas7-scores/patient/${session.user.user_id}`, session),
  week: (session: Session) => getData<Uas7Week>(`/uas7-scores/week/${session.user.user_id}`, session),
  async create(session: Session, entry: { medical_record_id: string; score_date: string; iss7: string; hss7: string; note?: string }) {
    if (!apiUrl) throw new Error('Chưa cấu hình địa chỉ backend.');
    try {
      const response = await apiClient.post<{ code: string; data: Uas7Entry }>(
        '/uas7-scores', entry, { headers: auth(session) },
      );
      if (response.data.code !== '1001') throw new Error('Không lưu được điểm UAS7.');
      return response.data.data;
    } catch (error) { throw apiError(error); }
  },
};
