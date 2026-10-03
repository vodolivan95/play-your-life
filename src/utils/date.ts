export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}
export function streak(days: string[], today = dayKey()): number {
  const set = new Set(days);
  let day = set.has(today) ? today : previousDay(today);
  let count = 0;
  while (set.has(day)) {
    count++;
    day = previousDay(day);
  }
  return count;
}
export function dateLabel(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}
