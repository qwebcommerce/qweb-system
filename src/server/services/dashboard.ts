import "server-only";
import type { DocumentData } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { can } from "@/config/permissions";
import { getRoleGrants } from "@/server/services/permissions";
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
import { asIso, asNullable, asNumber, asText, collectDocuments, database, live } from "@/server/db";
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
  figures: { revenue: number; expenses: number; profit: number; outstanding: number; pending: number; projected: number; labor: number; payroll: number } | null;
  cash: { cash: number; bank: number; available: number } | null;
  chart: Array<{ month: string; revenue: number; expenses: number }>;
  breakdown: Array<{ key: "salary" | "project" | "operational" | "other"; amount: number }>;
  recent: Array<{ id: string; kind: "revenue" | "expense"; title: string; amount: number; date: string }>;
  upcoming: Array<{ id: string; title: string; amount: number; dueDate: string; status: string }>;
  delayed: Array<{ id: string; title: string; date: string }>;
  accounts: Array<{ id: string; name: string; type: "cash" | "bank"; balance: number }>;
  projects: Array<{ id: string; title: string; expenses: number; labor: number; profit: number }>;
  laborByEmployee: Array<{ id: string; name: string; hours: number; cost: number }>;
  activity: Array<{ id: string; description: string; createdAt: string; module: string }>;
  reconciliation: Array<{ code: "payroll_missing_expense" | "missing_account" | "balance_mismatch" | "duplicate_key"; count: number }>;
}

export async function loadDashboard(
  user: SessionUser,
  period: Period,
  custom?: { from?: string; to?: string },
): Promise<DashboardData> {
  await live();
  const range = periodRange(period, custom);
  const grants = await getRoleGrants();
  const tasks = can(user.role, "tasks.view", grants) ? await loadTasks(user) : [];
  if (!can(user.role, "finance.view", grants)) {
    return {
      kind: "staff",
      range,
      tasks,
      figures: null,
      cash: null,
      chart: [],
      breakdown: [],
      recent: [],
      upcoming: [],
      delayed: [],
      accounts: [],
      projects: [],
      laborByEmployee: [],
      activity: [],
      reconciliation: [],
    };
  }

  const db = database();
  const [expenseDocs, revenueDocs, projectDocs, payrollDocs, accountDocs, transactionDocs, categoryDocs, laborDocs, employeeDocs, activitySnap] = await Promise.all([
    collectDocuments(db.collection(collections.expenses).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.revenue).orderBy("date", "desc"), row),
    collectDocuments(db.collection(collections.projects).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.payroll).orderBy("updatedAt", "desc"), row),
    collectDocuments(db.collection(collections.accounts), row),
    collectDocuments(db.collection(collections.accountTransactions), row),
    db.collection(collections.expenseCategories).get(),
    collectDocuments(db.collection(collections.laborAllocations), row),
    collectDocuments(db.collection(collections.employees), row),
    db.collection(collections.activityLogs).orderBy("createdAt", "desc").limit(12).get(),
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
  const openProjects = projectDocs.filter((doc) => doc.status !== "cancelled");
  const activeAccounts = accountDocs.filter((doc) => doc.status !== "inactive");
  const cashBalance = roundMoney(sum(activeAccounts.filter((doc) => doc.type === "cash").map((doc) => asNumber(doc.currentBalance))));
  const bankBalance = roundMoney(sum(activeAccounts.filter((doc) => doc.type === "bank").map((doc) => asNumber(doc.currentBalance))));
  const names = new Map(employeeDocs.map((doc) => [doc.id, asText(doc.fullName) || doc.id]));
  const laborGroups = new Map<string, { hours: number; cost: number }>();
  for (const doc of laborDocs) {
    const date = asText(doc.date);
    if (date < range.from || date > range.to) continue;
    const id = asText(doc.employeeId);
    const current = laborGroups.get(id) ?? { hours: 0, cost: 0 };
    current.hours = roundMoney(current.hours + asNumber(doc.hours));
    current.cost = roundMoney(current.cost + asNumber(doc.totalCost));
    laborGroups.set(id, current);
  }
  const laborByEmployee = [...laborGroups.entries()]
    .map(([id, value]) => ({ id, name: names.get(id) ?? id, hours: value.hours, cost: value.cost }))
    .sort((a, b) => b.cost - a.cost);

  return {
    kind: "finance",
    range,
    tasks: tasks.slice(0, 6),
    figures: {
      revenue,
      expenses,
      profit: companyProfit(revenue, expenses),
      outstanding: roundMoney(sum(openProjects.filter((doc) => asNumber(doc.contractBalance) > 0).map((doc) => asNumber(doc.contractBalance)))),
      pending: roundMoney(sum(expenseDocs.filter((doc) => (doc.status === "pending" || doc.status === "overdue") && inRange(doc.dueDate)).map((doc) => asNumber(doc.amount)))),
      projected: roundMoney(sum(openProjects.map((doc) => asNumber(doc.netProfit)))),
      labor: roundMoney(sum(laborByEmployee.map((item) => item.cost))),
      payroll: roundMoney(sum(payrollDocs.filter((doc) => doc.status === "paid" && inRange(doc.paymentDate)).map((doc) => asNumber(doc.totalPayable)))),
    },
    cash: { cash: cashBalance, bank: bankBalance, available: roundMoney(cashBalance + bankBalance) },
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
    accounts: activeAccounts.map((doc) => ({
      id: doc.id,
      name: asText(doc.name),
      type: doc.type === "bank" ? "bank" as const : "cash" as const,
      balance: asNumber(doc.currentBalance),
    })),
    projects: openProjects
      .map((doc) => ({
        id: doc.id,
        title: asText(doc.title),
        expenses: asNumber(doc.totalExpenses),
        labor: asNumber(doc.laborCost),
        profit: asNumber(doc.netProfit),
      }))
      .sort((a, b) => b.profit - a.profit),
    laborByEmployee,
    activity: activitySnap.docs.map((doc) => ({
      id: doc.id,
      description: asText(doc.data().description),
      createdAt: asIso(doc.data().createdAt),
      module: asText(doc.data().module),
    })),
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
  await live();
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
