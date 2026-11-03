import { fromCents, roundMoney, sumMoney, toCents } from "@/lib/financial/money";
import type { ScheduleFrequency } from "@/types";

export interface PayrollInput {
  basicSalary: number;
  bonuses: number[];
  deductions: number[];
  adjustments: number[];
}

export interface ProjectFigures {
  contractValue: number;
  collectedAmount: number;
  projectExpenses: number;
  laborCost: number;
}

export interface CompanyLedgerRecord {
  id: string;
  kind: "expense" | "payroll" | "labor" | "transfer" | "schedule" | "revenue";
  amount: number;
  sourceType?: "manual" | "payroll" | "recurring" | null;
  sourceId?: string | null;
  status?: "paid" | "pending" | "received" | "cancelled" | "draft" | null;
}

export interface ProjectLedgerRecord extends CompanyLedgerRecord {
  projectId: string | null;
  countsAsProjectExpense?: boolean;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function payableTotal(input: PayrollInput): number {
  return fromCents(
    toCents(input.basicSalary) +
      toCents(sumMoney(input.bonuses)) +
      toCents(sumMoney(input.adjustments)) -
      toCents(sumMoney(input.deductions)),
  );
}

export function laborCost(hours: number, hourlyCost: number): number {
  return fromCents(toCents(hours * hourlyCost));
}

export function projectSummary(figures: ProjectFigures) {
  return {
    contractBalance: roundMoney(figures.contractValue - figures.collectedAmount),
    netProfit: roundMoney(figures.contractValue - figures.projectExpenses - figures.laborCost),
    collectedProfit: roundMoney(
      figures.collectedAmount - figures.projectExpenses - figures.laborCost,
    ),
  };
}

export function companyProfit(revenue: number, paidExpenses: number): number {
  return roundMoney(revenue - paidExpenses);
}

/**
 * Company expenses come from paid expense documents, including the single
 * expense created when payroll is paid. Payroll rows, labor allocations,
 * transfers, and recurring schedules are not added again.
 */
export function companyExpenseTotal(records: CompanyLedgerRecord[]): number {
  const postedPayroll = new Set(
    records
      .filter(
        (record) =>
          record.kind === "expense" &&
          record.sourceType === "payroll" &&
          record.sourceId &&
          record.status === "paid",
      )
      .map((record) => record.sourceId),
  );

  let cents = 0;
  for (const record of records) {
    if (record.kind === "expense" && record.status === "paid") {
      cents += toCents(record.amount);
      continue;
    }
    if (record.kind === "payroll" && record.status === "paid" && !postedPayroll.has(record.id)) {
      continue;
    }
  }
  return fromCents(cents);
}

export function companyRevenueTotal(records: CompanyLedgerRecord[]): number {
  return sumMoney(
    records
      .filter((record) => record.kind === "revenue" && record.status === "received")
      .map((record) => record.amount),
  );
}

export function projectTotals(contractValue: number, projectId: string, records: ProjectLedgerRecord[]) {
  let collected = 0;
  let expenses = 0;
  let labor = 0;

  for (const record of records) {
    if (record.projectId !== projectId) continue;
    if (record.kind === "revenue" && record.status === "received") {
      collected += record.amount;
    }
    if (
      record.kind === "expense" &&
      record.status === "paid" &&
      record.countsAsProjectExpense !== false &&
      record.sourceType !== "payroll"
    ) {
      expenses += record.amount;
    }
    if (record.kind === "labor") {
      labor += record.amount;
    }
  }

  return projectSummary({
    contractValue,
    collectedAmount: roundMoney(collected),
    projectExpenses: roundMoney(expenses),
    laborCost: roundMoney(labor),
  });
}

export function payrollIdempotencyKey(payrollId: string): string {
  return `payroll:${payrollId}`;
}

export function sourceIdempotencyKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

export function occurrenceKey(scheduleId: string, dueDate: string): string {
  if (!ISO_DATE.test(dueDate)) {
    throw new Error("Due date must use YYYY-MM-DD.");
  }
  return `${scheduleId}_${dueDate}`;
}

export function findDuplicateKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

export function findPaidPayrollWithoutExpense(
  payrolls: Array<{ id: string; status: string; expenseId: string | null }>,
): string[] {
  return payrolls.filter((payroll) => payroll.status === "paid" && !payroll.expenseId).map((payroll) => payroll.id);
}

export function nextDueDate(
  isoDate: string,
  frequency: ScheduleFrequency,
  anchorDay?: number,
): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new Error("Due date must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (frequency === "daily") {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  if (frequency === "yearly") {
    return clampDate(year + 1, month, anchorDay ?? day);
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return clampDate(nextYear, nextMonth, anchorDay ?? day);
}

export function pendingOccurrenceDates(
  nextDue: string,
  frequency: ScheduleFrequency,
  through: string,
  scheduleId: string,
  anchorDay?: number,
): Array<{ date: string; key: string }> {
  const items: Array<{ date: string; key: string }> = [];
  let cursor = nextDue;
  let guard = 0;

  while (cursor <= through) {
    guard += 1;
    if (guard > 3700) {
      throw new Error("Occurrence window is too large.");
    }
    items.push({ date: cursor, key: occurrenceKey(scheduleId, cursor) });
    cursor = nextDueDate(cursor, frequency, anchorDay);
  }

  return items;
}

export function applyAccountEntry(
  balance: number,
  direction: "in" | "out",
  amount: number,
): number {
  if (amount < 0) throw new Error("Account amounts must be positive.");
  const delta = direction === "in" ? toCents(amount) : -toCents(amount);
  return fromCents(toCents(balance) + delta);
}

function clampDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}
