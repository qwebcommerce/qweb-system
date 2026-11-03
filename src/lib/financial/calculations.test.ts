import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ar } from "@/i18n/ar";
import { dictionaryKeys } from "@/i18n";
import { en } from "@/i18n/en";
import {
  applyAccountEntry,
  companyExpenseTotal,
  companyProfit,
  companyRevenueTotal,
  findDuplicateKeys,
  findPaidPayrollWithoutExpense,
  laborCost,
  nextDueDate,
  payableTotal,
  pendingOccurrenceDates,
  payrollIdempotencyKey,
  projectTotals,
} from "@/lib/financial/calculations";
import { sumMoney } from "@/lib/financial/money";

describe("payroll and labor", () => {
  it("calculates payable total from salary, bonuses, adjustments, and deductions", () => {
    assert.equal(
      payableTotal({
        basicSalary: 5000,
        bonuses: [200, 50],
        deductions: [100],
        adjustments: [25],
      }),
      5175,
    );
  });

  it("allows a negative payable when deductions exceed the salary", () => {
    assert.equal(
      payableTotal({ basicSalary: 100, bonuses: [], deductions: [150], adjustments: [] }),
      -50,
    );
  });

  it("calculates labor as hours times hourly cost without treating it as cash", () => {
    assert.equal(laborCost(7.5, 80), 600);
  });
});

describe("company totals", () => {
  it("counts a payroll payment once, through its expense", () => {
    const expenses = companyExpenseTotal([
      { id: "exp-rent", kind: "expense", amount: 100, sourceType: "manual", status: "paid" },
      {
        id: "exp-pay",
        kind: "expense",
        amount: 1000,
        sourceType: "payroll",
        sourceId: "pay-1",
        status: "paid",
      },
      { id: "pay-1", kind: "payroll", amount: 1000, status: "paid" },
      { id: "labor-1", kind: "labor", amount: 400, status: null },
      { id: "transfer-1", kind: "transfer", amount: 200, status: null },
      { id: "schedule-1", kind: "schedule", amount: 300, status: null },
      { id: "exp-open", kind: "expense", amount: 50, sourceType: "manual", status: "pending" },
    ]);
    const revenue = companyRevenueTotal([
      { id: "rev-1", kind: "revenue", amount: 3000, status: "received" },
      { id: "rev-2", kind: "revenue", amount: 500, status: "cancelled" },
    ]);

    assert.equal(expenses, 1100);
    assert.equal(revenue, 3000);
    assert.equal(companyProfit(revenue, expenses), 1900);
  });

  it("does not invent an expense for paid payroll that has no linked expense", () => {
    assert.equal(
      companyExpenseTotal([{ id: "pay-2", kind: "payroll", amount: 800, status: "paid" }]),
      0,
    );
    assert.deepEqual(
      findPaidPayrollWithoutExpense([
        { id: "pay-2", status: "paid", expenseId: null },
        { id: "pay-3", status: "paid", expenseId: "exp-3" },
        { id: "pay-4", status: "draft", expenseId: null },
      ]),
      ["pay-2"],
    );
  });
});

describe("project totals", () => {
  it("keeps contract value, collected cash, direct costs, and labor apart", () => {
    const summary = projectTotals(10000, "project-1", [
      {
        id: "rev",
        kind: "revenue",
        amount: 4000,
        projectId: "project-1",
        status: "received",
      },
      {
        id: "cost",
        kind: "expense",
        amount: 1500,
        projectId: "project-1",
        status: "paid",
        sourceType: "manual",
        countsAsProjectExpense: true,
      },
      {
        id: "salary",
        kind: "expense",
        amount: 5000,
        projectId: "project-1",
        status: "paid",
        sourceType: "payroll",
        sourceId: "pay-9",
        countsAsProjectExpense: false,
      },
      { id: "hours", kind: "labor", amount: 2000, projectId: "project-1", status: null },
      {
        id: "other-project",
        kind: "expense",
        amount: 999,
        projectId: "project-2",
        status: "paid",
        sourceType: "manual",
      },
    ]);

    assert.deepEqual(summary, {
      contractBalance: 6000,
      netProfit: 6500,
      collectedProfit: 500,
    });
  });
});

describe("recurring occurrences", () => {
  it("keeps the original day of month, including month end", () => {
    assert.equal(nextDueDate("2026-01-31", "monthly", 31), "2026-02-28");
    assert.equal(nextDueDate("2026-02-28", "monthly", 31), "2026-03-31");
    assert.equal(nextDueDate("2024-02-29", "yearly", 29), "2025-02-28");
    assert.equal(nextDueDate("2026-11-03", "daily"), "2026-11-04");
  });

  it("builds one key per due date and detects duplicates", () => {
    const dates = pendingOccurrenceDates("2026-01-31", "monthly", "2026-03-31", "sched", 31);
    assert.deepEqual(
      dates.map((item) => item.date),
      ["2026-01-31", "2026-02-28", "2026-03-31"],
    );
    assert.deepEqual(findDuplicateKeys(dates.map((item) => item.key)), []);
    assert.deepEqual(findDuplicateKeys(["sched_2026-01-31", "sched_2026-01-31"]), [
      "sched_2026-01-31",
    ]);
  });
});

describe("accounts", () => {
  it("moves money between accounts without changing the combined balance", () => {
    const cash = applyAccountEntry(1000, "out", 200);
    const bank = applyAccountEntry(500, "in", 200);
    assert.equal(cash, 800);
    assert.equal(bank, 700);
    assert.equal(sumMoney([cash, bank]), 1500);
  });

  it("uses a stable payroll idempotency key", () => {
    assert.equal(payrollIdempotencyKey("pay-1"), payrollIdempotencyKey("pay-1"));
  });
});

describe("translations", () => {
  it("gives Arabic every English key", () => {
    assert.deepEqual(dictionaryKeys(ar).sort(), dictionaryKeys(en).sort());
  });
});
