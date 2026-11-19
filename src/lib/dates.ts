/** 한국 시간 기준 날짜 도구 */
export function todayKST(): Date {
  const now = new Date();
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
/** 그 주 월요일 */
export function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0 일요일
  return addDays(d, day === 0 ? -6 : 1 - day);
}
export function monthKey(d: Date) {
  return iso(d).slice(0, 7);
}
