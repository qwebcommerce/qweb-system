import { format, parseISO } from "date-fns";
import type { DateFormat, Locale } from "@/types";

export function formatMoney(amount: number, currency = "QAR", locale: Locale = "en"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-QA" : "en-QA", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    numberingSystem: "latn",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDisplayDate(value: string, pattern: DateFormat): string {
  const date = value.length <= 10 ? parseISO(value) : new Date(value);
  return format(date, pattern);
}
