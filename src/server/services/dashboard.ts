import "server-only";
import type { DocumentData } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { can } from "@/config/permissions";
import { addIsoDays, eachMonth, monthKey, periodRange, qatarToday, type Period } from "@/lib/dates";
import {
  applyAccountEntry,
  companyExpenseTotal,
  companyProfit,
  companyRevenueTotal,
  findDuplicateKeys,
  findPaidPayrollWithoutExpense,
  type CompanyLedgerRecord,
} from "@/lib/financial/calculations";
import { roundMoney } from "@/lib/financial/money";
import { asNullable, asNumber, asText, collectDocuments, database } from "@/server/db";
import { staffEmployeeId } from "@/server/services/directory";
import type { SessionUser, TaskStatus } from "@/types";

export interface DashboardTask {
  id: string;
  description: string;
  taskDate: string;
  status: TaskStatus;
  projectId: string | null;
}

export interface DashboardData {
  kind: "staff" | "finance";
  range: { from: string; to: string };
  tasks: DashboardTask[];
  figures: { revenue: number; expenses: number; profit: number; outstanding: number } | null;
  chart: Array<{ month: string; revenue: number; expenses: number }>;
  breakdown: Array<{ key: "salary" | "project" | "operational" | "other"; amount: number }>;
  recent: Array<{ id: string; kind: "revenue" | "expense"; title: string; amount: number; date: string }>;
  upcoming: Array<{ id: string; title: string; amount: number; dueDate: string; status: string }>;
  delayed: Array<{ id: string; title: string; date: string }>;
  reconciliation: Array<{ code: "payroll_missing_expense" | "missing_account" | "balance_mismatch" | "duplicate_key"; count: number }>;
}

export async function loadDashboard(
  user: SessionUser,
  period: Period,
  custom?: { from?: string; to?: string },
): Promise<DashboardData> {
  const range = periodRange(period, custom);
  const tasks = await loadTasks(user);
  if (!can(user.role, "finance.view")) {
    return {
      kind: "staff",
      range,
      tasks,
      figures: null,
      chart: [],
      breakdown: [],
      recent: [],
      upcoming: [],
      delayed: [],
      reconciliation: [],
    };
  }

  const db = database();
  const [expenseDocs, revenueDocs, projectDocs, payrollDocs, accountDocs, transactionDocs, categoryDocs] = await Promise.all([
    collectDocuments(db.collection(collections.expenses).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.revenue).orderBy("date", "desc"), row),
    collectDocuments(db.collection(collections.projects).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.payroll).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.accounts), row),
    collectDocuments(db.collection(collections.accountTransactions), row),
    db.collection(collections.expenseCategories).get(),
  ]);

  const systemKey = new Map(categoryDocs.docs.map((doc) => [doc.id, asNullable(doc.data().systemKey)]));
  const inRange = (value: unknown) => {
    const date = asText(value);
    return date >= range.from && date <= range.to;
  };
  const paid = expenseDocs.filter((doc) => doc.status === "paid" && inRange(doc.paidAt || doc.expenseDate || doc.dueDate));
  const received = revenueDocs.filter((doc) => doc.status === "received" && inRange(doc.date));
  const expenseRecords: CompanyLedgerRecord[] = paid.map((doc) => ({
    id: doc.id,
    kind: "expense",
    amount: asNumber(doc.amount),
    sourceType: doc.sourceType === "payroll" || doc.sourceType === "recurring" || doc.sourceType === "manual" ? doc.sourceType : null,
    sourceId: asNullable(doc.sourceId),
    status: "paid",
  }));
  const revenueRecords: CompanyLedgerRecord[] = received.map((doc) => ({
    id: doc.id,
    kind: "revenue",
    amount: asNumber(doc.amount),
    status: "received",
  }));
  const revenue = companyRevenueTotal(revenueRecords);
  const expenses = companyExpenseTotal(expenseRecords);
  const months = eachMonth(range.from, range.to);
  const chart = months.map((month) => ({
    month,
    revenue: roundMoney(sum(received.filter((doc) => monthKey(asText(doc.date)) === month).map((doc) => asNumber(doc.amount)))),
    expenses: roundMoney(sum(paid.filter((doc) => monthKey(asText(doc.paidAt || doc.expenseDate || doc.dueDate)) === month).map((doc) => asNumber(doc.amount)))),
  }));
  const buckets = { salary: 0, project: 0, operational: 0, other: 0 };
  for (const doc of paid) {
    const key = doc.sourceType === "payroll" ? "salary" : bucketFor(systemKey.get(asText(doc.categoryId)) ?? null);
    buckets[key] = roundMoney(buckets[key] + asNumber(doc.amount));
  }
  const today = qatarToday();
  const soon = addIsoDays(today, 14);
  const outstandingProjects = projectDocs.filter((doc) => doc.status !== "cancelled" && asNumber(doc.contractBalance) > 0);

  return {
    kind: "finance",
    range,
    tasks: tasks.slice(0, 6),
    figures: {
      revenue,
      expenses,
      profit: companyProfit(revenue, expenses),
      outstanding: roundMoney(sum(outstandingProjects.map((doc) => asNumber(doc.contractBalance)))),
    },
    chart,
    breakdown: (Object.keys(buckets) as Array<keyof typeof buckets>).map((key) => ({ key, amount: buckets[key] })),
    recent: [
      ...received.map((doc) => ({ id: doc.id, kind: "revenue" as const, title: asText(doc.description), amount: asNumber(doc.amount), date: asText(doc.date) })),
      ...paid.map((doc) => ({ id: doc.id, kind: "expense" as const, title: asText(doc.title), amount: asNumber(doc.amount), date: asText(doc.paidAt || doc.dueDate) })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8),
    upcoming: expenseDocs
      .filter((doc) => (doc.status === "pending" || doc.status === "overdue") && asText(doc.dueDate) <= soon)
      .sort((a, b) => asText(a.dueDate).localeCompare(asText(b.dueDate)))
      .slice(0, 8)
      .map((doc) => ({ id: doc.id, title: asText(doc.title), amount: asNumber(doc.amount), dueDate: asText(doc.dueDate), status: asText(doc.status) })),
    delayed: projectDocs
      .filter((doc) => doc.status !== "completed" && doc.status !== "cancelled" && asText(doc.plannedDeliveryDate) && asText(doc.plannedDeliveryDate) < today)
      .slice(0, 6)
      .map((doc) => ({ id: doc.id, title: asText(doc.title), date: asText(doc.plannedDeliveryDate) })),
    reconciliation: reconcile(payrollDocs, expenseDocs, revenueDocs, accountDocs, transactionDocs),
  };
}

function row(id: string, data: DocumentData): Record<string, unknown> & { id: string } {
  return { id, ...data };
}

function bucketFor(systemKey: string | null): "salary" | "project" | "operational" | "other" {
  if (systemKey === "salary" || systemKey === "project" || systemKey === "other") return systemKey;
  return "operational";
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

async function loadTasks(user: SessionUser): Promise<DashboardTask[]> {
  const employeeId = user.role === "staff" ? await staffEmployeeId(user) : null;
  if (user.role === "staff" && !employeeId) return [];
  const query = employeeId
    ? database().collection(collections.tasks).where("assignedToId", "==", employeeId).limit(100)
    : database().collection(collections.tasks).orderBy("taskDate", "desc").limit(100);
  const snapshot = await query.get();
  const today = qatarToday();
  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      description: asText(doc.data().description),
      taskDate: asText(doc.data().taskDate),
      status: (doc.data().status ?? "pending") as TaskStatus,
      projectId: asNullable(doc.data().projectId),
    }))
    .filter((task) => task.status !== "completed" && task.status !== "cancelled")
    .sort((a, b) => a.taskDate.localeCompare(b.taskDate))
    .filter((task) => user.role === "staff" || task.taskDate <= addIsoDays(today, 7))
    .slice(0, 12);
}

function reconcile(
  payrollDocs: Array<Record<string, unknown> & { id: string }>,
  expenseDocs: Array<Record<string, unknown> & { id: string }>,
  revenueDocs: Array<Record<string, unknown> & { id: string }>,
  accountDocs: Array<Record<string, unknown> & { id: string }>,
  transactionDocs: Array<Record<string, unknown> & { id: string }>,
) {
  const missingPayroll = findPaidPayrollWithoutExpense(
    payrollDocs.map((doc) => ({ id: doc.id, status: asText(doc.status), expenseId: asNullable(doc.expenseId) })),
  ).length;
  const missingAccount = [...expenseDocs, ...revenueDocs].filter((doc) => {
    const posted = doc.status === "paid" || doc.status === "received";
    return posted && !asNullable(doc.accountId);
  }).length;
  const posted = transactionDocs.filter((doc) => doc.status === "posted");
  const duplicates = findDuplicateKeys(posted.map((doc) => asText(doc.idempotencyKey)).filter(Boolean)).length;
  let mismatches = 0;
  for (const account of accountDocs) {
    let balance = asNumber(account.openingBalance);
    for (const txn of posted.filter((doc) => doc.accountId === account.id)) {
      const direction = txn.direction === "in" ? "in" : "out";
      balance = applyAccountEntry(balance, direction, asNumber(txn.amount));
    }
    if (roundMoney(balance) !== roundMoney(asNumber(account.currentBalance))) mismatches += 1;
  }
  return [
    { code: "payroll_missing_expense" as const, count: missingPayroll },
    { code: "missing_account" as const, count: missingAccount },
    { code: "balance_mismatch" as const, count: mismatches },
    { code: "duplicate_key" as const, count: duplicates },
  ].filter((item) => item.count > 0);
}
