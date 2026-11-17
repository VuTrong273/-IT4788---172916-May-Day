import test from 'node:test';
import assert from 'node:assert/strict';
import { trendDays, shiftDay } from '../src/features/tracking/uas7-trend-data.ts';

test('calendar arithmetic crosses leap days and year boundaries', () => {
  assert.equal(shiftDay('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
});
test('zero is recorded while a missing day remains null', () => {
  const days = trendDays([{ score_date: '2026-10-27', daily_score: '0' }], '2026-10-28', 2);
  assert.deepEqual(days.map(({ score }) => score), [0, null]);
});
test('range is inclusive, chronological and ignores entries outside it', () => {
  const days = trendDays([
    { score_date: '2026-10-29', daily_score: '6' },
    { score_date: '2026-10-28', daily_score: '3' },
    { score_date: '2026-09-28', daily_score: '1' },
  ], '2026-10-28', 30);
  assert.equal(days.length, 30);
  assert.equal(days[0].date, '2026-09-29');
  assert.equal(days.at(-1).score, 3);
  assert.equal(days.filter(({ score }) => score !== null).length, 1);
});
