import { addDays, addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfWeek, startOfYear } from "date-fns";

export type Period = "today" | "week" | "month" | "year" | "custom";

const QATAR = "Asia/Qatar";

export function qatarToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: QATAR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function periodRange(
  period: Period,
  custom?: { from?: string; to?: string },
  now = new Date(),
): { from: string; to: string } {
  const today = qatarToday(now);
  const anchor = new Date(`${today}T12:00:00`);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    return {
      from: format(startOfWeek(anchor, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      to: today,
    };
  }
  if (period === "month") {
    return { from: format(startOfMonth(anchor), "yyyy-MM-dd"), to: format(endOfMonth(anchor), "yyyy-MM-dd") };
  }
  if (period === "year") {
    return { from: format(startOfYear(anchor), "yyyy-MM-dd"), to: format(endOfYear(anchor), "yyyy-MM-dd") };
  }
  return {
    from: custom?.from || format(startOfMonth(anchor), "yyyy-MM-dd"),
    to: custom?.to || today,
  };
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function addIsoDays(isoDate: string, days: number): string {
  return format(addDays(new Date(`${isoDate}T12:00:00`), days), "yyyy-MM-dd");
}

export function eachMonth(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(new Date(`${from}T12:00:00`));
  const end = startOfMonth(new Date(`${to}T12:00:00`));
  while (cursor <= end && months.length < 36) {
    months.push(format(cursor, "yyyy-MM"));
    cursor = addMonths(cursor, 1);
  }
  return months;
}
