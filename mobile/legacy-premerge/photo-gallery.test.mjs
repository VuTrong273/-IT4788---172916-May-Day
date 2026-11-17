import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPhotos, photoDate } from '../src/features/tracking/photo-gallery-data.ts';
const image = (id, time, part = null) => ({ photo_id: id, taken_at: time, created_at: time, body_part: part });
test('date filters use Vietnam dates across a UTC midnight boundary', () => {
  const photo = image('1', '2026-10-27T18:00:00Z');
  assert.equal(photoDate(photo), '2026-10-28');
  assert.equal(filterPhotos([photo], '', '2026-10-28', '2026-10-28').length, 1);
});
test('filters by location and sorts newest first without mutating input', () => {
  const photos = [image('1', '2026-10-01T00:00:00Z', 'Arm'), image('2', '2026-10-02T00:00:00Z', 'Arm'), image('3', '2026-10-03T00:00:00Z')];
  assert.deepEqual(filterPhotos(photos, 'Arm', '', '').map(p => p.photo_id), ['2', '1']);
  assert.equal(photos[0].photo_id, '1');
});
test('invalid range is empty and absent taken_at falls back to created_at', () => {
  const photo = { ...image('1', '2026-10-01T00:00:00Z'), taken_at: null };
  assert.equal(photoDate(photo), '2026-10-01');
  assert.equal(filterPhotos([photo], '', '2026-10-02', '2026-10-01').length, 0);
});
