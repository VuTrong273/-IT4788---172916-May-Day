import {
  apiRequest,
  ApiRequestError,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type Uas7Eligibility = {
  eligible: 'true' | 'false';
  medical_record_id?: string;
};

export type Uas7Score = {
  patient_id: string;
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Uas7Week = {
  patient_id: string;
  week_score: string;
  severity_label: string;
  completed_days: string;
};

export type CreateUas7Score = {
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  note?: string;
};

function translatedFailure(error: unknown): Error {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error : new Error('Yêu cầu UAS7 thất bại.');
  }

  let message: string | undefined;
  switch (error.apiCode) {
    case '5001':
      message = 'Bệnh án hiện không đủ điều kiện chấm UAS7. Điểm chưa được lưu.';
      break;
    case '5002':
      message = 'Ngày này đã có điểm UAS7. Hãy chọn ngày khác; điểm mới chưa được lưu.';
      break;
    case '5003':
      message = 'Điểm ngứa phải nằm trong khoảng 0–3.';
      break;
    case '5004':
      message = 'Điểm số lượng mề đay phải nằm trong khoảng 0–3.';
      break;
    case '3105':
    case '3106':
      message = 'Bạn không được phép xem dữ liệu UAS7 của bệnh nhân này.';
      break;
    case '3001':
    case '3002':
    case '3003':
      message = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
      break;
    default:
      if (error.status === 401) {
        message = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
      }
  }

  return message
    ? new ApiRequestError({
        kind: error.kind,
        status: error.status,
        apiCode: error.apiCode,
        operation: error.operation,
        retryable: error.retryable,
        message,
      })
    : error;
}

async function request<T>(
  session: Session,
  method: 'get' | 'post',
  path: string,
  body?: CreateUas7Score,
  params?: Record<string, string>,
): Promise<T> {
  const operation = `${method.toUpperCase()} ${path}`;
  const acceptedCodes = method === 'post' ? ['1001'] : ['1000'];
  try {
    const response = await apiRequest<ApiEnvelope<T>>(
      { method, url: path, data: body, params },
      session.token,
    );
    return requireApiCode(response, acceptedCodes, operation).data;
  } catch (error) {
    throw translatedFailure(error);
  }
}

export const uas7Api = {
  eligibility(session: Session): Promise<Uas7Eligibility> {
    return request(session, 'get', '/uas7-scores/eligibility');
  },

  create(session: Session, score: CreateUas7Score): Promise<Uas7Score> {
    return request(session, 'post', '/uas7-scores', score);
  },

  history(session: Session, patientId: number): Promise<Uas7Score[]> {
    return request(session, 'get', `/uas7-scores/patient/${patientId}`);
  },

  week(
    session: Session,
    patientId: number,
    startDate?: string,
  ): Promise<Uas7Week> {
    return request(
      session,
      'get',
      `/uas7-scores/week/${patientId}`,
      undefined,
      startDate ? { start_date: startDate } : undefined,
    );
  },
};
