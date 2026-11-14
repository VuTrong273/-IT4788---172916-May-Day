import {
  apiRequest,
  requireApiCode,
  type ApiEnvelope,
} from '@/api/client';
import type { Session } from '@/features/auth/session';

export type LesionEpisode = {
  episode_id: string;
  medical_record_id: string;
  patient_id: string;
  name: string;
  occurred_at: string | null;
  context_tags: string | null;
  context_other: string | null;
  medication_name: string | null;
  medication_taken_ago: string | null;
  medication_unit: 'minute' | 'hour' | 'day' | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type LesionEpisodeInput = {
  medical_record_id: string;
  name: string;
  occurred_at: string | null;
  context_tags: string | null;
  context_other: string | null;
  medication_name: string | null;
  medication_taken_ago: string | null;
  medication_unit: LesionEpisode['medication_unit'];
  description: string | null;
};

export type LesionEpisodeUpdate = Omit<LesionEpisodeInput, 'medical_record_id'>;

async function request<T>(
  session: Session,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  data?: object,
  params?: Record<string, string>,
  acceptedCodes: readonly string[] = ['1000'],
): Promise<T> {
  const response = await apiRequest<ApiEnvelope<T>>(
    { method, url: path, data, params },
    session.token,
  );
  return requireApiCode(response, acceptedCodes, `${method.toUpperCase()} ${path}`).data;
}

export const lesionEpisodesApi = {
  create: (session: Session, input: LesionEpisodeInput) =>
    request<LesionEpisode>(
      session,
      'post',
      '/lesion-episodes',
      input,
      undefined,
      ['1001'],
    ),

  listMine: (session: Session, medicalRecordId?: string) =>
    request<LesionEpisode[]>(
      session,
      'get',
      '/lesion-episodes/my',
      undefined,
      medicalRecordId ? { medical_record_id: medicalRecordId } : undefined,
    ),

  listByRecord: (session: Session, medicalRecordId: string) =>
    request<LesionEpisode[]>(
      session,
      'get',
      `/lesion-episodes/record/${encodeURIComponent(medicalRecordId)}`,
    ),

  get: (session: Session, episodeId: string) =>
    request<LesionEpisode>(
      session,
      'get',
      `/lesion-episodes/${encodeURIComponent(episodeId)}`,
    ),

  update: (session: Session, episodeId: string, input: LesionEpisodeUpdate) =>
    request<LesionEpisode>(
      session,
      'patch',
      `/lesion-episodes/${encodeURIComponent(episodeId)}`,
      input,
    ),

  remove: (session: Session, episodeId: string) =>
    request<Record<string, never>>(
      session,
      'delete',
      `/lesion-episodes/${encodeURIComponent(episodeId)}`,
    ),
};

export function validateLesionEpisodeInput(input: LesionEpisodeInput): string | null {
  if (!/^\d+$/.test(input.medical_record_id)) return 'Chọn một bệnh án hợp lệ.';
  if (!input.name.trim()) return 'Vui lòng nhập tên đợt tổn thương.';
  if (input.occurred_at && Number.isNaN(Date.parse(input.occurred_at))) {
    return 'Thời điểm xuất hiện không hợp lệ.';
  }
  if (
    input.medication_taken_ago !== null &&
    !/^\d+$/.test(input.medication_taken_ago)
  ) {
    return 'Thời gian đã dùng thuốc cần là số nguyên.';
  }
  return null;
}

export function sortLesionEpisodesChronologically(episodes: LesionEpisode[]): LesionEpisode[] {
  return [...episodes].sort((a, b) => {
    const aTime = Date.parse(a.occurred_at ?? a.created_at);
    const bTime = Date.parse(b.occurred_at ?? b.created_at);
    return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
  });
}
