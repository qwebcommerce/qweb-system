"use server";

import { z } from "zod";
import { authorized } from "@/server/actions/guard";
import {
  cancelRevenue,
  expensesForExport,
  generateDueOccurrences,
  generatePayroll,
  markPayrollPaid,
  removeExpense,
  revenueForExport,
  saveAccount,
  saveExpense,
  saveRevenue,
  saveSchedule,
  setScheduleActive,
  transferFunds,
  updatePayroll,
} from "@/server/services/finance";
import type { ExpenseStatus, PaymentMethod, ScheduleFrequency } from "@/types";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.coerce.number().finite().min(0);
const optionalId = z.union([z.string().trim().min(1).max(120), z.literal(""), z.null()]).optional().transform((value) => value || null);
const method = z.enum(["cash", "cheque", "card", "bank_transfer"]);
const cheque = z.object({
  number: text(40),
  bankName: text(80),
  date,
  clearanceStatus: z.enum(["pending", "cleared", "bounced", "cancelled"]),
}).nullable();

const expenseSchema = z.object({
  categoryId: required(120),
  title: required(180),
  amount: money,
  dueDate: date,
  expenseDate: optionalId,
  status: z.enum(["paid", "pending", "overdue", "cancelled"]),
  paymentMethod: z.union([method, z.literal(""), z.null()]).optional().transform((value) => value || null),
  clientId: optionalId,
  projectId: optionalId,
  notes: text(4000),
  accountId: optionalId,
  paidOn: optionalId,
  cheque,
});

const scheduleSchema = z.object({
  categoryId: required(120),
  title: required(180),
  amount: money,
  frequency: z.enum(["daily", "monthly", "yearly"]),
  startDate: date,
  endDate: optionalId,
  clientId: optionalId,
  projectId: optionalId,
  defaultPaymentMethod: z.union([method, z.literal(""), z.null()]).optional().transform((value) => value || null),
  notes: text(4000),
});

const revenueSchema = z.object({
  date,
  clientId: required(120),
  projectId: optionalId,
  categoryId: required(120),
  description: required(300),
  amount: money.positive(),
  paymentMethod: method,
  notes: text(4000),
  accountId: optionalId,
  cheque,
});

const accountSchema = z.object({
  name: required(120),
  type: z.enum(["cash", "bank"]),
  bankName: optionalId,
  accountNumberLast4: z.union([z.string().trim().max(4), z.literal(""), z.null()]).optional().transform((value) => value || null),
  openingBalance: money,
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  notes: text(1000),
});

const transferSchema = z.object({
  fromAccountId: required(120),
  toAccountId: required(120),
  amount: money.positive(),
  date,
  notes: text(500),
});

const line = z.object({
  id: required(80),
  title: required(120),
  amount: money,
  notes: text(300),
});

const payrollEditSchema = z.object({
  bonuses: z.array(line).max(20),
  deductions: z.array(line).max(20),
  adjustments: z.array(line).max(20),
  notes: text(1000),
});

const payrollPaySchema = z.object({
  paymentDate: date,
  paymentMethod: method,
  accountId: optionalId,
  notes: text(1000),
});

export async function saveExpenseAction(input: unknown, id?: string) {
  const data = expenseSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => saveExpense(user, {
    ...data.data,
    expenseDate: data.data.expenseDate,
    status: data.data.status as ExpenseStatus,
    paymentMethod: data.data.paymentMethod as PaymentMethod | null,
    clientId: data.data.clientId,
    projectId: data.data.projectId,
    accountId: data.data.accountId,
    paidOn: data.data.paidOn,
  }, id));
}

export async function removeExpenseAction(id: string) {
  return authorized("finance.view", (user) => removeExpense(user, id).then(() => null));
}

export async function saveScheduleAction(input: unknown, id?: string) {
  const data = scheduleSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => saveSchedule(user, {
    ...data.data,
    frequency: data.data.frequency as ScheduleFrequency,
    endDate: data.data.endDate,
    clientId: data.data.clientId,
    projectId: data.data.projectId,
    defaultPaymentMethod: data.data.defaultPaymentMethod as PaymentMethod | null,
  }, id));
}

export async function setScheduleActiveAction(id: string, active: boolean) {
  return authorized("finance.view", () => setScheduleActive(id, active).then(() => null));
}

export async function generateDueAction() {
  return authorized("finance.view", (user) => generateDueOccurrences(user));
}

export async function saveRevenueAction(input: unknown, id?: string) {
  const data = revenueSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => saveRevenue(user, {
    ...data.data,
    projectId: data.data.projectId,
    accountId: data.data.accountId,
    paymentMethod: data.data.paymentMethod as PaymentMethod,
  }, id));
}

export async function cancelRevenueAction(id: string) {
  return authorized("finance.view", (user) => cancelRevenue(user, id).then(() => null));
}

export async function saveAccountAction(input: unknown, id?: string) {
  const data = accountSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => saveAccount(user, {
    ...data.data,
    currency: data.data.currency.toUpperCase(),
    bankName: data.data.bankName,
    accountNumberLast4: data.data.accountNumberLast4,
  }, id));
}

export async function transferAction(input: unknown) {
  const data = transferSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => transferFunds(user, data.data).then(() => null));
}

export async function generatePayrollAction(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => generatePayroll(user, month));
}

export async function updatePayrollAction(id: string, input: unknown) {
  const data = payrollEditSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => updatePayroll(user, id, data.data).then(() => null));
}

export async function payPayrollAction(id: string, input: unknown) {
  const data = payrollPaySchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("finance.view", (user) => markPayrollPaid(user, id, {
    ...data.data,
    accountId: data.data.accountId,
    paymentMethod: data.data.paymentMethod as PaymentMethod,
  }).then(() => null));
}

export async function exportExpensesAction(status?: string) {
  return authorized("finance.view", () => expensesForExport(status));
}

export async function exportRevenueAction() {
  return authorized("finance.view", () => revenueForExport());
}
