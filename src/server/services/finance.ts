import "server-only";
import type { DocumentData, Transaction } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { keywords } from "@/lib/keywords";
import { qatarToday } from "@/lib/dates";
import { applyAccountEntry, nextDueDate, occurrenceKey, payableTotal } from "@/lib/financial/calculations";
import { roundMoney } from "@/lib/financial/money";
import { allocateCode, asIso, asNullable, asNumber, asText, collectDocuments, database, live, stamp, type Page, PAGE_SIZE } from "@/server/db";
import { activityRecord } from "@/server/services/activity";
import { RecordError, projectFigures } from "@/server/services/directory";
import type {
  AccountTransaction,
  CashAccount,
  ChequeDetails,
  Expense,
  ExpenseStatus,
  PaymentMethod,
  Payroll,
  PayrollStatus,
  RecurringExpense,
  Revenue,
  ScheduleFrequency,
  SessionUser,
} from "@/types";

const expenses = () => database().collection(collections.expenses);
const schedules = () => database().collection(collections.recurringExpenses);
const revenue = () => database().collection(collections.revenue);
const payroll = () => database().collection(collections.payroll);
const accounts = () => database().collection(collections.accounts);
const accountTxns = () => database().collection(collections.accountTransactions);
const employees = () => database().collection(collections.employees);

function mapExpense(id: string, data: DocumentData): Expense {
  return {
    id,
    code: asText(data.code),
    categoryId: asText(data.categoryId),
    title: asText(data.title),
    amount: asNumber(data.amount),
    frequency: data.frequency ?? "one_time",
    dueDate: asText(data.dueDate),
    expenseDate: asNullable(data.expenseDate),
    isRecurringOccurrence: data.isRecurringOccurrence === true,
    recurringExpenseId: asNullable(data.recurringExpenseId),
    occurrenceKey: asNullable(data.occurrenceKey),
    status: (data.status as ExpenseStatus) ?? "pending",
    paymentMethod: (data.paymentMethod as PaymentMethod | null) ?? null,
    clientId: asNullable(data.clientId),
    projectId: asNullable(data.projectId),
    notes: asText(data.notes),
    paidAt: asNullable(data.paidAt),
    accountId: asNullable(data.accountId),
    accountTransactionId: asNullable(data.accountTransactionId),
    sourceType: data.sourceType ?? "manual",
    sourceId: asNullable(data.sourceId),
    countsAsProjectExpense: data.countsAsProjectExpense !== false && data.sourceType !== "payroll",
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapRevenue(id: string, data: DocumentData): Revenue {
  return {
    id,
    code: asText(data.code),
    date: asText(data.date),
    clientId: asText(data.clientId),
    projectId: asNullable(data.projectId),
    categoryId: asText(data.categoryId),
    description: asText(data.description),
    amount: asNumber(data.amount),
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? "bank_transfer",
    notes: asText(data.notes),
    accountId: asNullable(data.accountId),
    accountTransactionId: asNullable(data.accountTransactionId),
    status: data.status === "cancelled" ? "cancelled" : "received",
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapAccount(id: string, data: DocumentData): CashAccount {
  return {
    id,
    code: asText(data.code),
    name: asText(data.name),
    type: data.type === "bank" ? "bank" : "cash",
    bankName: asNullable(data.bankName),
    accountNumberLast4: asNullable(data.accountNumberLast4),
    openingBalance: asNumber(data.openingBalance),
    currentBalance: asNumber(data.currentBalance),
    currency: asText(data.currency, "QAR"),
    status: data.status === "inactive" ? "inactive" : "active",
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapPayroll(id: string, data: DocumentData): Payroll {
  return {
    id,
    code: asText(data.code),
    employeeId: asText(data.employeeId),
    employeeName: asText(data.employeeName),
    month: asText(data.month),
    basicSalary: asNumber(data.basicSalary),
    bonuses: data.bonuses ?? [],
    deductions: data.deductions ?? [],
    adjustments: data.adjustments ?? [],
    totalPayable: asNumber(data.totalPayable),
    status: (data.status as PayrollStatus) ?? "pending",
    paymentDate: asNullable(data.paymentDate),
    paymentMethod: (data.paymentMethod as PaymentMethod | null) ?? null,
    expenseId: asNullable(data.expenseId),
    accountId: asNullable(data.accountId),
    accountTransactionId: asNullable(data.accountTransactionId),
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function projectContribution(data: DocumentData | null) {
  if (!data || data.status === "cancelled" || data.countsAsProjectExpense === false || data.sourceType === "payroll" || !data.projectId) {
    return { projectId: null as string | null, amount: 0 };
  }
  return { projectId: String(data.projectId), amount: asNumber(data.amount) };
}

function collectedContribution(data: DocumentData | null) {
  if (!data || data.status === "cancelled" || !data.projectId) return { projectId: null as string | null, amount: 0 };
  return { projectId: String(data.projectId), amount: asNumber(data.amount) };
}

function opposite(direction: "in" | "out"): "in" | "out" {
  return direction === "in" ? "out" : "in";
}

async function readRefs(tx: Transaction, collectionName: string, ids: Array<string | null | undefined>) {
  await live();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const snaps = await Promise.all(unique.map(async (id) => tx.get(database().collection(collectionName).doc(id))));
  return new Map(snaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap]));
}

type ProjectDelta = { expenses: number; collected: number };

function queueProjectDelta(
  deltas: Map<string, ProjectDelta>,
  projectId: string | null,
  field: keyof ProjectDelta,
  amount: number,
) {
  if (!projectId || amount === 0) return;
  const current = deltas.get(projectId) ?? { expenses: 0, collected: 0 };
  current[field] = roundMoney(current[field] + amount);
  deltas.set(projectId, current);
}

function commitProjectDeltas(
  tx: Transaction,
  snaps: Map<string, FirebaseFirestore.DocumentSnapshot>,
  deltas: Map<string, ProjectDelta>,
) {
  for (const [projectId, delta] of deltas) {
    if (delta.expenses === 0 && delta.collected === 0) continue;
    const snap = snaps.get(projectId);
    if (!snap?.exists) continue;
    tx.update(snap.ref, projectFigures(snap.data()!, delta));
  }
}

function syncAccount(
  tx: Transaction,
  user: SessionUser,
  sourceType: "revenue" | "expense",
  sourceId: string,
  description: string,
  date: string,
  method: PaymentMethod | null,
  cheque: ChequeDetails | null,
  previous: { accountId: string | null; amount: number; active: boolean; direction: "in" | "out" } | null,
  next: { accountId: string | null; amount: number; active: boolean; direction: "in" | "out" } | null,
  accountSnaps: Map<string, FirebaseFirestore.DocumentSnapshot>,
) {
  const txnRef = accountTxns().doc(`${sourceType}_${sourceId}`);
  const prev = previous?.active && previous.accountId ? previous : null;
  const nxt = next?.active && next.accountId ? next : null;
  const move = (accountId: string, direction: "in" | "out", amount: number) => {
    const snap = accountSnaps.get(accountId);
    if (!snap?.exists) throw new RecordError("invalid");
    tx.update(snap.ref, {
      currentBalance: applyAccountEntry(asNumber(snap.data()?.currentBalance), direction, amount),
      updatedAt: stamp(),
    });
  };

  if (prev && nxt && prev.accountId === nxt.accountId && prev.direction === nxt.direction) {
    const delta = roundMoney(nxt.amount - prev.amount);
    if (delta !== 0) move(nxt.accountId!, delta > 0 ? nxt.direction : opposite(nxt.direction), Math.abs(delta));
  } else {
    if (prev?.accountId) move(prev.accountId, opposite(prev.direction), prev.amount);
    if (nxt?.accountId) move(nxt.accountId, nxt.direction, nxt.amount);
  }

  if (!nxt) {
    if (prev) tx.set(txnRef, { status: "reversed", updatedAt: stamp() }, { merge: true });
    return null;
  }
  tx.set(
    txnRef,
    {
      code: txnRef.id,
      accountId: nxt.accountId,
      type: nxt.direction === "in" ? "receipt" : "payment",
      amount: nxt.amount,
      direction: nxt.direction,
      date,
      paymentMethod: method,
      sourceType,
      sourceId,
      transferGroupId: null,
      idempotencyKey: `${sourceType}:${sourceId}`,
      description,
      notes: "",
      cheque,
      status: "posted",
      reversalOf: null,
      updatedAt: stamp(),
      createdBy: user.uid,
      ...(prev ? {} : { createdAt: stamp() }),
    },
    { merge: true },
  );
  return txnRef.id;
}

export async function refreshOverdueExpenses() {
  await live();
  const today = qatarToday();
  const due = await expenses().where("status", "==", "pending").where("dueDate", "<", today).limit(100).get();
  if (due.empty) return;
  const batch = database().batch();
  due.docs.forEach((doc) => batch.update(doc.ref, { status: "overdue", updatedAt: stamp() }));
  await batch.commit();
}

export async function listExpenses(filters: { search?: string; status?: string; cursor?: string | null }): Promise<Page<Expense>> {
  await live();
  await refreshOverdueExpenses();
  let query = expenses().orderBy("updatedAt", "desc").limit(PAGE_SIZE + 1);
  if (filters.search && filters.search.trim().length >= 2) {
    query = expenses().where("keywords", "array-contains", filters.search.trim().toLowerCase().split(/\s+/)[0]!).limit(50);
  } else if (filters.status && filters.status !== "all") {
    query = expenses().where("status", "==", filters.status).orderBy("updatedAt", "desc").limit(PAGE_SIZE + 1);
  }
  if (!filters.search && filters.cursor) {
    const cursor = await expenses().doc(filters.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.get();
  const docs = filters.search ? snapshot.docs : snapshot.docs.slice(0, PAGE_SIZE);
  return { items: docs.map((doc) => mapExpense(doc.id, doc.data())), nextCursor: !filters.search && snapshot.size > PAGE_SIZE ? docs.at(-1)?.id ?? null : null };
}

export async function expensesFor(field: "projectId" | "clientId", id: string) {
  await live();
  const snapshot = await expenses().where(field, "==", id).limit(100).get();
  return snapshot.docs.map((doc) => mapExpense(doc.id, doc.data()));
}

type ExpenseInput = {
  categoryId: string;
  title: string;
  amount: number;
  dueDate: string;
  expenseDate: string | null;
  status: ExpenseStatus;
  paymentMethod: PaymentMethod | null;
  clientId: string | null;
  projectId: string | null;
  notes: string;
  accountId: string | null;
  paidOn: string | null;
  cheque: ChequeDetails | null;
};

export async function saveExpense(user: SessionUser, input: ExpenseInput, id?: string) {
  await live();
  const db = database();
  const ref = id ? expenses().doc(id) : expenses().doc();
  await db.runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    if (existing?.data()?.sourceType === "payroll") throw new RecordError("invalid");
    const allocated = existing?.exists ? null : await allocateCode(tx, "expenses", "EXP");
    const projectSnaps = await readRefs(tx, collections.projects, [existing?.data()?.projectId, input.projectId]);
    const accountSnaps = await readRefs(tx, collections.accounts, [existing?.data()?.accountId, input.accountId]);
    const next = {
      categoryId: input.categoryId,
      title: input.title,
      amount: input.amount,
      frequency: existing?.data()?.frequency ?? "one_time",
      dueDate: input.dueDate,
      expenseDate: input.expenseDate,
      isRecurringOccurrence: existing?.data()?.isRecurringOccurrence === true,
      recurringExpenseId: existing?.data()?.recurringExpenseId ?? null,
      occurrenceKey: existing?.data()?.occurrenceKey ?? null,
      status: input.status,
      paymentMethod: input.paymentMethod,
      clientId: input.clientId,
      projectId: input.projectId,
      notes: input.notes,
      accountId: input.status === "paid" ? input.accountId : null,
      paidAt: input.status === "paid" ? input.paidOn ?? qatarToday() : null,
      sourceType: existing?.data()?.sourceType ?? "manual",
      sourceId: existing?.data()?.sourceId ?? null,
      countsAsProjectExpense: Boolean(input.projectId),
      keywords: keywords(input.title, allocated?.code ?? existing?.data()?.code),
      code: existing?.data()?.code ?? allocated!.code,
      updatedAt: stamp(),
    };
    const before = projectContribution(existing?.data() ?? null);
    const after = projectContribution(next);
    const projectDeltas = new Map<string, ProjectDelta>();
    queueProjectDelta(projectDeltas, before.projectId, "expenses", -before.amount);
    queueProjectDelta(projectDeltas, after.projectId, "expenses", after.amount);
    commitProjectDeltas(tx, projectSnaps, projectDeltas);
    const accountTransactionId = syncAccount(
      tx,
      user,
      "expense",
      ref.id,
      input.title,
      input.paidOn ?? input.dueDate,
      input.paymentMethod,
      input.cheque,
      existing?.data() ? { accountId: asNullable(existing.data()?.accountId), amount: asNumber(existing.data()?.amount), active: existing.data()?.status === "paid", direction: "out" } : null,
      { accountId: next.accountId, amount: next.amount, active: next.status === "paid", direction: "out" },
      accountSnaps,
    );
    if (!existing?.exists) tx.set(allocated!.ref, { value: allocated!.value });
    tx.set(ref, { ...next, accountTransactionId, ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }) }, { merge: true });
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "expense.updated" : "expense.created",
      module: "expenses",
      recordId: ref.id,
      description: existing?.exists ? "Updated an expense." : "Created an expense.",
      previousValues: existing?.data() ? { amount: existing.data()?.amount, status: existing.data()?.status } : null,
      newValues: { title: input.title, amount: input.amount, status: input.status },
    }));
  });
  return ref.id;
}

export async function removeExpense(user: SessionUser, id: string) {
  await live();
  const existing = await expenses().doc(id).get();
  if (!existing.exists) throw new RecordError("not_found");
  if (existing.data()?.sourceType === "payroll") throw new RecordError("invalid");
  if (existing.data()?.status === "paid") {
    const current = mapExpense(existing.id, existing.data()!);
    await saveExpense(user, { ...current, expenseDate: current.expenseDate, status: "cancelled", accountId: current.accountId, paidOn: current.paidAt, cheque: null }, id);
    return;
  }
  await saveExpense(user, { ...mapExpense(existing.id, existing.data()!), expenseDate: asNullable(existing.data()?.expenseDate), status: "cancelled", accountId: null, paidOn: null, cheque: null }, id);
  await expenses().doc(id).delete();
}

function mapSchedule(id: string, data: DocumentData): RecurringExpense {
  return {
    id,
    code: asText(data.code),
    categoryId: asText(data.categoryId),
    title: asText(data.title),
    amount: asNumber(data.amount),
    frequency: data.frequency ?? "monthly",
    startDate: asText(data.startDate),
    anchorDay: asNumber(data.anchorDay),
    nextDueDate: asText(data.nextDueDate),
    endDate: asNullable(data.endDate),
    active: data.active !== false,
    clientId: asNullable(data.clientId),
    projectId: asNullable(data.projectId),
    defaultPaymentMethod: (data.defaultPaymentMethod as PaymentMethod | null) ?? null,
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

export async function listSchedules() {
  await live();
  const snapshot = await schedules().orderBy("updatedAt", "desc").limit(100).get();
  return snapshot.docs.map((doc) => mapSchedule(doc.id, doc.data()));
}

export async function saveSchedule(user: SessionUser, input: { categoryId: string; title: string; amount: number; frequency: ScheduleFrequency; startDate: string; endDate: string | null; clientId: string | null; projectId: string | null; defaultPaymentMethod: PaymentMethod | null; notes: string }, id?: string) {
  await live();
  const ref = id ? schedules().doc(id) : schedules().doc();
  const anchorDay = Number(input.startDate.slice(8, 10));
  await database().runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "schedules", "SCH");
    if (allocated) tx.set(allocated.ref, { value: allocated.value });
    tx.set(ref, {
      ...input,
      anchorDay,
      nextDueDate: existing?.data()?.nextDueDate ?? input.startDate,
      active: existing?.data()?.active !== false,
      code: existing?.data()?.code ?? allocated!.code,
      updatedAt: stamp(),
      ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }),
    }, { merge: true });
  });
  return ref.id;
}

export async function setScheduleActive(id: string, active: boolean) {
  await live();
  await schedules().doc(id).update({ active, updatedAt: stamp() });
}

export async function generateDueOccurrences(user: SessionUser, through = qatarToday()) {
  await live();
  const active = await schedules().where("active", "==", true).get();
  let created = 0;
  for (const schedule of active.docs) {
    const data = schedule.data();
    const items: Array<{ date: string; key: string }> = [];
    const endDate = asNullable(data.endDate);
    let cursor = asText(data.nextDueDate);
    while (cursor && cursor <= through && (!endDate || cursor <= endDate) && items.length < 62) {
      items.push({ date: cursor, key: occurrenceKey(schedule.id, cursor) });
      cursor = nextDueDate(cursor, data.frequency, asNumber(data.anchorDay));
    }
    if (items.length === 0) continue;
    const db = database();
    await db.runTransaction(async (tx) => {
      const current = await tx.get(schedule.ref);
      if (!current.exists) return;
      const existing = await Promise.all(items.map(async (item) => tx.get(expenses().doc(item.key))));
      const projectSnaps = await readRefs(tx, collections.projects, [current.data()?.projectId]);
      const projectDeltas = new Map<string, ProjectDelta>();
      let added = 0;
      existing.forEach((snap, index) => {
        if (snap.exists) return;
        const item = items[index]!;
        const counts = Boolean(current.data()?.projectId);
        tx.set(snap.ref, {
          code: `EXP-${item.key.slice(-12)}`,
          categoryId: current.data()?.categoryId,
          title: current.data()?.title,
          amount: asNumber(current.data()?.amount),
          frequency: current.data()?.frequency,
          dueDate: item.date,
          expenseDate: item.date,
          isRecurringOccurrence: true,
          recurringExpenseId: schedule.id,
          occurrenceKey: item.key,
          status: "pending",
          paymentMethod: current.data()?.defaultPaymentMethod ?? null,
          clientId: current.data()?.clientId ?? null,
          projectId: current.data()?.projectId ?? null,
          notes: current.data()?.notes ?? "",
          paidAt: null,
          accountId: null,
          accountTransactionId: null,
          sourceType: "recurring",
          sourceId: schedule.id,
          countsAsProjectExpense: counts,
          keywords: keywords(asText(current.data()?.title), item.date),
          createdAt: stamp(),
          updatedAt: stamp(),
          createdBy: user.uid,
        });
        if (counts) queueProjectDelta(projectDeltas, asText(current.data()?.projectId), "expenses", asNumber(current.data()?.amount));
        added += 1;
      });
      commitProjectDeltas(tx, projectSnaps, projectDeltas);
      tx.update(schedule.ref, { nextDueDate: cursor, active: !endDate || !cursor || cursor <= endDate, updatedAt: stamp() });
      created += added;
    });
  }
  return created;
}

export async function listRevenue(filters: { search?: string; cursor?: string | null }): Promise<Page<Revenue>> {
  await live();
  let query = revenue().orderBy("date", "desc").limit(PAGE_SIZE + 1);
  if (filters.search && filters.search.trim().length >= 2) query = revenue().where("keywords", "array-contains", filters.search.trim().toLowerCase().split(/\s+/)[0]!).limit(50);
  if (!filters.search && filters.cursor) {
    const cursor = await revenue().doc(filters.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.get();
  const docs = filters.search ? snapshot.docs : snapshot.docs.slice(0, PAGE_SIZE);
  return { items: docs.map((doc) => mapRevenue(doc.id, doc.data())), nextCursor: !filters.search && snapshot.size > PAGE_SIZE ? docs.at(-1)?.id ?? null : null };
}

export async function revenueFor(field: "projectId" | "clientId", id: string) {
  await live();
  const snapshot = await revenue().where(field, "==", id).limit(100).get();
  return snapshot.docs.map((doc) => mapRevenue(doc.id, doc.data()));
}

export async function saveRevenue(user: SessionUser, input: { date: string; clientId: string; projectId: string | null; categoryId: string; description: string; amount: number; paymentMethod: PaymentMethod; notes: string; accountId: string | null; cheque: ChequeDetails | null }, id?: string) {
  await live();
  const ref = id ? revenue().doc(id) : revenue().doc();
  await database().runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "revenue", "REV");
    const projectSnaps = await readRefs(tx, collections.projects, [existing?.data()?.projectId, input.projectId]);
    const accountSnaps = await readRefs(tx, collections.accounts, [existing?.data()?.accountId, input.accountId]);
    const next = { ...input, status: existing?.data()?.status === "cancelled" ? "cancelled" : "received", keywords: keywords(input.description, allocated?.code ?? existing?.data()?.code), code: existing?.data()?.code ?? allocated!.code, updatedAt: stamp() };
    const before = collectedContribution(existing?.data() ?? null);
    const after = collectedContribution(next);
    const projectDeltas = new Map<string, ProjectDelta>();
    queueProjectDelta(projectDeltas, before.projectId, "collected", -before.amount);
    queueProjectDelta(projectDeltas, after.projectId, "collected", after.amount);
    commitProjectDeltas(tx, projectSnaps, projectDeltas);
    const accountTransactionId = syncAccount(tx, user, "revenue", ref.id, input.description, input.date, input.paymentMethod, input.cheque, existing?.data() ? { accountId: asNullable(existing.data()?.accountId), amount: asNumber(existing.data()?.amount), active: existing.data()?.status !== "cancelled", direction: "in" } : null, { accountId: input.accountId, amount: input.amount, active: next.status === "received", direction: "in" }, accountSnaps);
    if (allocated) tx.set(allocated.ref, { value: allocated.value });
    tx.set(ref, { ...next, accountTransactionId, ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }) }, { merge: true });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "revenue.updated" : "revenue.created",
      module: "revenue",
      recordId: ref.id,
      description: existing?.exists ? "Updated received revenue." : "Recorded received revenue.",
      newValues: { amount: input.amount, projectId: input.projectId },
    }));
  });
  return ref.id;
}

export async function cancelRevenue(user: SessionUser, id: string) {
  await live();
  const existing = await revenue().doc(id).get();
  if (!existing.exists) throw new RecordError("not_found");
  const current = mapRevenue(existing.id, existing.data()!);
  await database().runTransaction(async (tx) => {
    const snap = await tx.get(existing.ref);
    const projectSnaps = await readRefs(tx, collections.projects, [snap.data()?.projectId]);
    const accountSnaps = await readRefs(tx, collections.accounts, [snap.data()?.accountId]);
    const before = collectedContribution(snap.data() ?? null);
    const projectDeltas = new Map<string, ProjectDelta>();
    queueProjectDelta(projectDeltas, before.projectId, "collected", -before.amount);
    commitProjectDeltas(tx, projectSnaps, projectDeltas);
    syncAccount(tx, user, "revenue", id, current.description, current.date, current.paymentMethod, null, { accountId: current.accountId, amount: current.amount, active: current.status === "received", direction: "in" }, { accountId: null, amount: 0, active: false, direction: "in" }, accountSnaps);
    tx.update(existing.ref, { status: "cancelled", updatedAt: stamp() });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "revenue.deleted",
      module: "revenue",
      recordId: id,
      description: "Cancelled received revenue and reversed its account posting.",
      previousValues: { amount: current.amount },
    }));
  });
}

export async function listAccounts() {
  await live();
  const snapshot = await accounts().orderBy("name").limit(100).get();
  return snapshot.docs.map((doc) => mapAccount(doc.id, doc.data()));
}

export async function saveAccount(user: SessionUser, input: { name: string; type: "cash" | "bank"; bankName: string | null; accountNumberLast4: string | null; openingBalance: number; currency: string; notes: string }, id?: string) {
  await live();
  const ref = id ? accounts().doc(id) : accounts().doc();
  await database().runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "accounts", "ACC");
    if (allocated) tx.set(allocated.ref, { value: allocated.value });
    const opening = input.openingBalance;
    const current = existing?.exists ? asNumber(existing.data()?.currentBalance) + (opening - asNumber(existing.data()?.openingBalance)) : opening;
    tx.set(ref, {
      ...input,
      accountNumberLast4: input.accountNumberLast4?.slice(-4) ?? null,
      currentBalance: roundMoney(current),
      status: existing?.data()?.status ?? "active",
      code: existing?.data()?.code ?? allocated!.code,
      updatedAt: stamp(),
      ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }),
    }, { merge: true });
  });
  return ref.id;
}

export async function listAccountTransactions(accountId?: string) {
  await live();
  const query = accountId ? accountTxns().where("accountId", "==", accountId).orderBy("date", "desc").limit(50) : accountTxns().orderBy("date", "desc").limit(30);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: asIso(doc.data().createdAt), updatedAt: asIso(doc.data().updatedAt) }) as AccountTransaction);
}

export async function transferFunds(user: SessionUser, input: { fromAccountId: string; toAccountId: string; amount: number; date: string; notes: string }) {
  await live();
  if (input.fromAccountId === input.toAccountId) throw new RecordError("invalid");
  const group = database().collection(collections.accountTransactions).doc().id;
  await database().runTransaction(async (tx) => {
    const from = await tx.get(accounts().doc(input.fromAccountId));
    const to = await tx.get(accounts().doc(input.toAccountId));
    if (!from.exists || !to.exists) throw new RecordError("not_found");
    tx.update(from.ref, { currentBalance: applyAccountEntry(asNumber(from.data()?.currentBalance), "out", input.amount), updatedAt: stamp() });
    tx.update(to.ref, { currentBalance: applyAccountEntry(asNumber(to.data()?.currentBalance), "in", input.amount), updatedAt: stamp() });
    const base = { amount: input.amount, date: input.date, paymentMethod: "bank_transfer", sourceType: "transfer", sourceId: group, transferGroupId: group, description: "Internal transfer", notes: input.notes, cheque: null, status: "posted", reversalOf: null, createdAt: stamp(), updatedAt: stamp(), createdBy: user.uid };
    tx.set(accountTxns().doc(`${group}_out`), { ...base, code: `${group}_out`, accountId: input.fromAccountId, type: "transfer_out", direction: "out", idempotencyKey: `transfer:${group}:out` });
    tx.set(accountTxns().doc(`${group}_in`), { ...base, code: `${group}_in`, accountId: input.toAccountId, type: "transfer_in", direction: "in", idempotencyKey: `transfer:${group}:in` });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "account.transfer",
      module: "accounts",
      recordId: group,
      description: "Transferred money between accounts. This is not revenue or an expense.",
      newValues: { amount: input.amount, from: input.fromAccountId, to: input.toAccountId },
    }));
  });
}

export async function listPayroll(month?: string) {
  await live();
  const query = month ? payroll().where("month", "==", month).limit(200) : payroll().orderBy("month", "desc").limit(50);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => mapPayroll(doc.id, doc.data()));
}

export async function generatePayroll(user: SessionUser, month: string) {
  await live();
  const snapshot = await employees().where("active", "==", true).limit(300).get();
  let created = 0;
  for (const employee of snapshot.docs) {
    if (employee.data().workingStatus === "inactive") continue;
    const ref = payroll().doc(`${employee.id}_${month}`);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.status !== "cancelled") continue;
    const basicSalary = asNumber(employee.data().basicSalary);
    await ref.set({
      code: `PAY-${month}-${asText(employee.data().code)}`,
      employeeId: employee.id,
      employeeName: asText(employee.data().fullName),
      month,
      basicSalary,
      bonuses: [],
      deductions: [],
      adjustments: [],
      totalPayable: basicSalary,
      status: "pending",
      paymentDate: null,
      paymentMethod: null,
      expenseId: null,
      accountId: null,
      accountTransactionId: null,
      notes: "",
      createdAt: stamp(),
      updatedAt: stamp(),
      createdBy: user.uid,
    });
    created += 1;
  }
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: user.uid,
    userName: user.displayName,
    action: "payroll.generated",
    module: "payroll",
    recordId: month,
    description: "Generated monthly payroll for active employees.",
    newValues: { month, created },
  }));
  return created;
}

export async function updatePayroll(user: SessionUser, id: string, input: { bonuses: Payroll["bonuses"]; deductions: Payroll["deductions"]; adjustments: Payroll["adjustments"]; notes: string }) {
  await live();
  const ref = payroll().doc(id);
  await database().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (!existing.exists) throw new RecordError("not_found");
    if (existing.data()?.status === "paid") throw new RecordError("conflict");
    const totalPayable = payableTotal({
      basicSalary: asNumber(existing.data()?.basicSalary),
      bonuses: input.bonuses.map((line) => line.amount),
      deductions: input.deductions.map((line) => line.amount),
      adjustments: input.adjustments.map((line) => line.amount),
    });
    tx.update(ref, { ...input, totalPayable, updatedAt: stamp() });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "payroll.updated",
      module: "payroll",
      recordId: id,
      description: "Edited payroll before payment.",
      newValues: { totalPayable },
    }));
  });
}

export async function markPayrollPaid(user: SessionUser, id: string, input: { paymentDate: string; paymentMethod: PaymentMethod; accountId: string | null; notes: string }) {
  await live();
  const expenseRef = expenses().doc(`payroll_${id}`);
  await database().runTransaction(async (tx) => {
    const record = await tx.get(payroll().doc(id));
    if (!record.exists) throw new RecordError("not_found");
    const expense = await tx.get(expenseRef);
    const salary = await tx.get(database().collection(collections.expenseCategories).doc("salary"));
    const accountSnaps = await readRefs(tx, collections.accounts, [input.accountId]);
    if (record.data()?.expenseId || expense.exists) return;
    const amount = asNumber(record.data()?.totalPayable);
    if (amount <= 0) throw new RecordError("invalid");
    const accountTransactionId = syncAccount(tx, user, "expense", expenseRef.id, `Payroll ${record.data()?.employeeName} ${record.data()?.month}`, input.paymentDate, input.paymentMethod, null, null, { accountId: input.accountId, amount, active: true, direction: "out" }, accountSnaps);
    tx.set(expenseRef, {
      code: `EXP-${asText(record.data()?.code)}`,
      categoryId: salary.exists ? "salary" : asText(record.data()?.categoryId, "salary"),
      title: `Payroll ${asText(record.data()?.employeeName)} ${asText(record.data()?.month)}`,
      amount,
      frequency: "one_time",
      dueDate: input.paymentDate,
      expenseDate: input.paymentDate,
      isRecurringOccurrence: false,
      recurringExpenseId: null,
      occurrenceKey: null,
      status: "paid",
      paymentMethod: input.paymentMethod,
      clientId: null,
      projectId: null,
      notes: input.notes,
      paidAt: input.paymentDate,
      accountId: input.accountId,
      accountTransactionId,
      sourceType: "payroll",
      sourceId: id,
      countsAsProjectExpense: false,
      keywords: keywords(asText(record.data()?.employeeName), asText(record.data()?.month)),
      createdAt: stamp(),
      updatedAt: stamp(),
      createdBy: user.uid,
    });
    tx.update(record.ref, { status: "paid", paymentDate: input.paymentDate, paymentMethod: input.paymentMethod, accountId: input.accountId, accountTransactionId, expenseId: expenseRef.id, notes: input.notes, updatedAt: stamp() });
    tx.set(database().collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "payroll.paid",
      module: "payroll",
      recordId: id,
      description: "Paid payroll and created one salary expense.",
      newValues: { amount, expenseId: expenseRef.id },
    }));
  });
}

export async function expensesForExport(status?: string) {
  await live();
  await refreshOverdueExpenses();
  const query = status && status !== "all" ? expenses().where("status", "==", status).orderBy("dueDate") : expenses().orderBy("dueDate");
  return collectDocuments(query, (id, data) => mapExpense(id, data), 5000);
}

export async function revenueForExport() {
  await live();
  return collectDocuments(revenue().orderBy("date", "desc"), (id, data) => mapRevenue(id, data), 5000);
}

export async function collectFinancial(collectionName: string) {
  await live();
  const snapshot = await database().collection(collectionName).limit(2000).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
