import { apiRequest, unwrapEnvelope } from '@/lib/api/client';
import type { Session } from '@/features/auth/auth-types';

export type RecordStatus = 'pending' | 'in_progress' | 'completed';

export type MedicalRecord = {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  template_id: string;
  status: RecordStatus;
  created_at: string;
};

export type MedicalRecordDetail = MedicalRecord & {
  created_by: number | null;
  instructions: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type MedicalRecordSummary = {
  medical_record_id: number;
  patient_name: string | null;
  status: RecordStatus;
  created_at: string;
};

type RecordListResponse = {
  code: string;
  message: string;
  data: MedicalRecord[];
  total: number;
  page: number;
  limit: number;
};

export async function listMedicalRecords(session: Session, options: {
  page?: number;
  limit?: number;
  status?: RecordStatus;
} = {}) {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 20) });
  if (options.status) params.set('status', options.status);
  return apiRequest<RecordListResponse>(`/medical_records/all?${params}`, { token: session.token });
}

export async function getMedicalRecord(session: Session, id: number) {
  const [recordResponse, summaryResponse] = await Promise.all([
    apiRequest(`/medical_records/${id}`, { token: session.token }),
    apiRequest(`/medical_records/${id}/summary`, { token: session.token }),
  ]);
  return {
    record: unwrapEnvelope<MedicalRecordDetail>(recordResponse),
    summary: unwrapEnvelope<MedicalRecordSummary>(summaryResponse),
  };
}

export function acceptMedicalRecord(session: Session, id: number) {
  return apiRequest(`/medical_records/${id}/accept`, {
    method: 'POST', body: '{}', token: session.token,
  }).then((response) => unwrapEnvelope<Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'>>(response));
}
