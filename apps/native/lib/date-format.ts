const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export { WEEKDAYS_PT };

/** Returns YYYY-MM for the given Date, defaulting to now. */
export function currentMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "Abril 2026" format for display. */
export function formatMonthLabelPt(date: Date): string {
  return `${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "há 2h", "ontem", "há 3 dias", "há 2 semanas", "há 1 mês". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffWeeks < 4) return `há ${diffWeeks} ${diffWeeks === 1 ? "semana" : "semanas"}`;
  return `há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
}

export interface MonthCell {
  day: number | null;
  inMonth: boolean;
  isToday: boolean;
  studied: boolean;
  dateStr: string | null;
}

/**
 * Build a 42-cell (7 cols × 6 rows) grid for a month.
 * Cells outside the target month have `inMonth: false` and `day: null`.
 */
export function buildMonthGrid(
  month: string,
  studiedSet: Set<string>,
  today: Date = new Date(),
): MonthCell[] {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dateStr = inMonth
      ? `${year}-${monthStr}-${String(dayNum).padStart(2, "0")}`
      : null;
    cells.push({
      day: inMonth ? dayNum : null,
      inMonth,
      isToday: inMonth && dateStr === todayStr,
      studied: inMonth && dateStr !== null && studiedSet.has(dateStr),
      dateStr,
    });
  }
  return cells;
}
