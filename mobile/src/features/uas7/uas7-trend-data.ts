import type { Uas7Score } from './uas7-api';

export function shiftDay(date: string, amount: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

export function trendDays(entries: Uas7Score[], end: string, length: number) {
  const byDate = new Map(entries.map((entry) => [entry.score_date, entry]));
  return Array.from({ length }, (_, index) => {
    const date = shiftDay(end, index - length + 1);
    const entry = byDate.get(date);
    return { date, entry, score: entry ? Number(entry.daily_score) : null };
  });
}
