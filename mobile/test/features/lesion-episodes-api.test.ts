import { describe, expect, it } from '@jest/globals';

import {
  sortLesionEpisodesChronologically,
  validateLesionEpisodeInput,
  type LesionEpisode,
  type LesionEpisodeInput,
} from '@/features/lesion-tracking/lesion-episodes-api';

const input: LesionEpisodeInput = {
  medical_record_id: '42',
  name: 'Rash after dinner',
  occurred_at: '2026-10-07T20:00:00.000Z',
  context_tags: '["stress"]',
  context_other: null,
  medication_name: null,
  medication_taken_ago: null,
  medication_unit: null,
  description: null,
};

function episode(episodeId: string, occurredAt: string | null): LesionEpisode {
  return {
    episode_id: episodeId,
    medical_record_id: '42',
    patient_id: '15',
    name: `Episode ${episodeId}`,
    occurred_at: occurredAt,
    context_tags: null,
    context_other: null,
    medication_name: null,
    medication_taken_ago: null,
    medication_unit: null,
    description: null,
    created_at: '2026-10-08T09:30:00.000Z',
    updated_at: '2026-10-08T09:30:00.000Z',
  };
}

describe('lesion episode validation and ordering', () => {
  it('requires an OpenAPI string medical-record identifier and a name', () => {
    expect(validateLesionEpisodeInput({ ...input, medical_record_id: '' })).toBe('Chọn một bệnh án hợp lệ.');
    expect(validateLesionEpisodeInput({ ...input, name: '  ' })).toBe('Vui lòng nhập tên đợt tổn thương.');
  });

  it('rejects invalid occurrence times and non-integer medication intervals', () => {
    expect(validateLesionEpisodeInput({ ...input, occurred_at: 'not-a-date' })).toBe(
      'Thời điểm xuất hiện không hợp lệ.',
    );
    expect(validateLesionEpisodeInput({ ...input, medication_taken_ago: '1.5' })).toBe(
      'Thời gian đã dùng thuốc cần là số nguyên.',
    );
  });

  it('orders by occurrence time, falling back to server creation time when absent', () => {
    const ordered = sortLesionEpisodesChronologically([
      episode('late', '2026-10-09T10:00:00.000Z'),
      episode('missing', null),
      episode('early', '2026-10-07T10:00:00.000Z'),
    ]);
    expect(ordered.map((item) => item.episode_id)).toEqual(['early', 'missing', 'late']);
  });
});
