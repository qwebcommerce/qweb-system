import "server-only";
import type { DocumentData } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { qatarToday } from "@/lib/dates";
import { keywords } from "@/lib/keywords";
import { laborCost, projectSummary } from "@/lib/financial/calculations";
import { roundMoney } from "@/lib/financial/money";
import {
  PAGE_SIZE,
  allocateCode,
  asIso,
  asNullable,
  asNumber,
  asText,
  database,
  live,
  stamp,
  type Page,
} from "@/server/db";
import { activityRecord } from "@/server/services/activity";
import type {
  Client,
  ClientStatus,
  ContractType,
  Employee,
  EmployeeType,
  LaborAllocation,
  Project,
  ProjectMember,
  ProjectStatus,
  SessionUser,
  Task,
  TaskStatus,
  WorkingStatus,
} from "@/types";

export class RecordError extends Error {
  constructor(readonly code: "not_found" | "linked" | "conflict" | "invalid") {
    super(code);
  }
}

const clients = () => database().collection(collections.clients);
const employees = () => database().collection(collections.employees);
const projects = () => database().collection(collections.projects);
const tasks = () => database().collection(collections.tasks);
const members = () => database().collection(collections.projectMembers);
const labor = () => database().collection(collections.laborAllocations);
const users = () => database().collection(collections.users);

function mapClient(id: string, data: DocumentData): Client {
  return {
    id,
    code: asText(data.code),
    name: asText(data.name),
    companyName: asText(data.companyName),
    contactPerson: asText(data.contactPerson),
    mobile: asText(data.mobile),
    email: asText(data.email),
    status: (data.status as ClientStatus) ?? "active",
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapEmployee(id: string, data: DocumentData): Employee {
  return {
    id,
    code: asText(data.code),
    fullName: asText(data.fullName),
    email: asText(data.email),
    mobile: asText(data.mobile),
    position: asText(data.position),
    type: (data.type as EmployeeType) ?? "staff",
    startDate: asText(data.startDate),
    basicSalary: asNumber(data.basicSalary),
    hourlyCost: asNumber(data.hourlyCost),
    workingStatus: (data.workingStatus as WorkingStatus) ?? "office",
    notes: asText(data.notes),
    photoURL: asNullable(data.photoURL),
    active: data.active !== false && data.workingStatus !== "inactive",
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapProject(id: string, data: DocumentData): Project {
  return {
    id,
    code: asText(data.code),
    title: asText(data.title),
    clientId: asText(data.clientId),
    clientName: asText(data.clientName),
    typeId: asText(data.typeId),
    contractValue: asNumber(data.contractValue),
    startDate: asText(data.startDate),
    plannedDeliveryDate: asText(data.plannedDeliveryDate),
    actualDeliveryDate: asNullable(data.actualDeliveryDate),
    status: (data.status as ProjectStatus) ?? "pending",
    contractType: (data.contractType as ContractType) ?? "one_time",
    collectedAmount: asNumber(data.collectedAmount),
    contractBalance: asNumber(data.contractBalance),
    totalExpenses: asNumber(data.totalExpenses),
    laborCost: asNumber(data.laborCost),
    netProfit: asNumber(data.netProfit),
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapTask(id: string, data: DocumentData): Task {
  return {
    id,
    code: asText(data.code),
    clientId: asText(data.clientId),
    projectId: asNullable(data.projectId),
    description: asText(data.description),
    taskDate: asText(data.taskDate),
    givenById: asText(data.givenById),
    assignedToId: asNullable(data.assignedToId),
    status: (data.status as TaskStatus) ?? "pending",
    staffNotes: asText(data.staffNotes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function mapLabor(id: string, data: DocumentData): LaborAllocation {
  return {
    id,
    projectId: asText(data.projectId),
    employeeId: asText(data.employeeId),
    date: asText(data.date),
    hours: asNumber(data.hours),
    hourlyCost: asNumber(data.hourlyCost),
    totalCost: asNumber(data.totalCost),
    description: asText(data.description),
    notes: asText(data.notes),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: asText(data.createdBy),
  };
}

function projectFigures(data: DocumentData, patch?: { contractValue?: number; collected?: number; expenses?: number; labor?: number }) {
  const contractValue = patch?.contractValue ?? asNumber(data.contractValue);
  const collectedAmount = roundMoney(asNumber(data.collectedAmount) + (patch?.collected ?? 0));
  const totalExpenses = roundMoney(asNumber(data.totalExpenses) + (patch?.expenses ?? 0));
  const laborAmount = roundMoney(asNumber(data.laborCost) + (patch?.labor ?? 0));
  const summary = projectSummary({
    contractValue,
    collectedAmount,
    projectExpenses: totalExpenses,
    laborCost: laborAmount,
  });
  return {
    contractValue,
    collectedAmount,
    totalExpenses,
    laborCost: laborAmount,
    contractBalance: summary.contractBalance,
    netProfit: summary.netProfit,
    updatedAt: stamp(),
  };
}

async function pageOf<T>(
  collectionName: string,
  filters: { search?: string; field?: string; value?: string; cursor?: string | null },
  map: (id: string, data: DocumentData) => T,
): Promise<Page<T>> {
  await live();
  const collection = database().collection(collectionName);
  let query = collection.orderBy("updatedAt", "desc").limit(PAGE_SIZE + 1);
  if (filters.search && filters.search.trim().length >= 2) {
    query = collection.where("keywords", "array-contains", filters.search.trim().toLowerCase().split(/\s+/)[0]!).limit(50);
  } else if (filters.field && filters.value && filters.value !== "all") {
    query = collection.where(filters.field, "==", filters.value).orderBy("updatedAt", "desc").limit(PAGE_SIZE + 1);
    if (filters.cursor) {
      const cursor = await collection.doc(filters.cursor).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }
  } else if (filters.cursor) {
    const cursor = await collection.doc(filters.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.get();
  const docs = filters.search ? snapshot.docs : snapshot.docs.slice(0, PAGE_SIZE);
  return {
    items: docs.map((doc) => map(doc.id, doc.data())),
    nextCursor: !filters.search && snapshot.size > PAGE_SIZE ? (docs.at(-1)?.id ?? null) : null,
  };
}

export function listClients(filters: { search?: string; status?: string; cursor?: string | null }) {
  return pageOf(collections.clients, { ...filters, field: "status", value: filters.status }, mapClient);
}

export async function getClient(id: string) {
  await live();
  const snapshot = await clients().doc(id).get();
  return snapshot.exists ? mapClient(snapshot.id, snapshot.data()!) : null;
}

export async function saveClient(user: SessionUser, input: Omit<Client, "id" | "code" | "createdAt" | "updatedAt" | "createdBy">, id?: string) {
  await live();
  const db = database();
  const ref = id ? clients().doc(id) : clients().doc();
  await db.runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "clients", "CLI");
    const payload = {
      name: input.name,
      companyName: input.companyName,
      contactPerson: input.contactPerson,
      mobile: input.mobile,
      email: input.email,
      status: input.status,
      notes: input.notes,
      keywords: keywords(input.name, input.companyName, input.contactPerson, input.email, input.mobile, allocated?.code ?? existing?.data()?.code),
      updatedAt: stamp(),
    };
    if (!existing?.exists) {
      tx.set(allocated!.ref, { value: allocated!.value });
      tx.set(ref, { ...payload, code: allocated!.code, createdAt: stamp(), createdBy: user.uid });
    } else {
      tx.update(ref, payload);
    }
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "client.updated" : "client.created",
      module: "clients",
      recordId: ref.id,
      description: existing?.exists ? "Updated a client." : "Created a client.",
      previousValues: existing?.data() ?? null,
      newValues: payload,
    }));
  });
  if (id) {
    const related = await projects().where("clientId", "==", id).limit(200).get();
    const batch = db.batch();
    related.docs.forEach((doc) => batch.update(doc.ref, { clientName: input.name }));
    if (!related.empty) await batch.commit();
  }
  return ref.id;
}

export function listEmployees(filters: { search?: string; status?: string; cursor?: string | null }) {
  return pageOf(collections.employees, { ...filters, field: "workingStatus", value: filters.status }, mapEmployee);
}

export async function listActiveEmployees() {
  await live();
  const snapshot = await employees().where("active", "==", true).limit(300).get();
  return snapshot.docs.map((doc) => mapEmployee(doc.id, doc.data())).filter((employee) => employee.workingStatus !== "inactive");
}

export async function getEmployee(id: string) {
  await live();
  const snapshot = await employees().doc(id).get();
  return snapshot.exists ? mapEmployee(snapshot.id, snapshot.data()!) : null;
}

export async function saveEmployee(
  user: SessionUser,
  input: Omit<Employee, "id" | "code" | "createdAt" | "updatedAt" | "createdBy" | "active">,
  id?: string,
) {
  await live();
  const db = database();
  const ref = id ? employees().doc(id) : employees().doc();
  const active = input.workingStatus !== "inactive";
  await db.runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "employees", "EMP");
    const payload = {
      ...input,
      active,
      photoURL: input.photoURL,
      keywords: keywords(input.fullName, input.email, input.mobile, input.position, allocated?.code ?? existing?.data()?.code),
      updatedAt: stamp(),
    };
    if (!existing?.exists) {
      tx.set(allocated!.ref, { value: allocated!.value });
      tx.set(ref, { ...payload, code: allocated!.code, createdAt: stamp(), createdBy: user.uid });
    } else {
      tx.update(ref, payload);
    }
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "employee.updated" : "employee.created",
      module: "employees",
      recordId: ref.id,
      description: existing?.exists ? "Updated an employee." : "Created an employee.",
      previousValues: existing?.exists ? { basicSalary: existing.data()?.basicSalary, hourlyCost: existing.data()?.hourlyCost, workingStatus: existing.data()?.workingStatus } : null,
      newValues: { fullName: input.fullName, basicSalary: input.basicSalary, hourlyCost: input.hourlyCost, workingStatus: input.workingStatus },
    }));
  });
  return ref.id;
}

export function listProjects(filters: { search?: string; status?: string; clientId?: string; cursor?: string | null }) {
  const field = filters.clientId ? "clientId" : "status";
  const value = filters.clientId || filters.status;
  return pageOf(collections.projects, { ...filters, field, value }, mapProject);
}

export async function getProject(id: string) {
  await live();
  const snapshot = await projects().doc(id).get();
  return snapshot.exists ? mapProject(snapshot.id, snapshot.data()!) : null;
}

export async function projectsForClient(clientId: string) {
  await live();
  const snapshot = await projects().where("clientId", "==", clientId).limit(100).get();
  return snapshot.docs.map((doc) => mapProject(doc.id, doc.data()));
}

export async function saveProject(
  user: SessionUser,
  input: {
    title: string;
    clientId: string;
    typeId: string;
    contractValue: number;
    startDate: string;
    plannedDeliveryDate: string;
    actualDeliveryDate: string | null;
    status: ProjectStatus;
    contractType: ContractType;
    notes: string;
  },
  id?: string,
) {
  await live();
  const db = database();
  const ref = id ? projects().doc(id) : projects().doc();
  await db.runTransaction(async (tx) => {
    const client = await tx.get(clients().doc(input.clientId));
    if (!client.exists) throw new RecordError("invalid");
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "projects", "PRJ");
    const figures = projectFigures(existing?.data() ?? {}, { contractValue: input.contractValue });
    const payload = {
      title: input.title,
      clientId: input.clientId,
      clientName: asText(client.data()?.name),
      typeId: input.typeId,
      startDate: input.startDate,
      plannedDeliveryDate: input.plannedDeliveryDate,
      actualDeliveryDate: input.actualDeliveryDate,
      status: input.status,
      contractType: input.contractType,
      notes: input.notes,
      ...figures,
      keywords: keywords(input.title, asText(client.data()?.name), allocated?.code ?? existing?.data()?.code),
    };
    if (!existing?.exists) {
      tx.set(allocated!.ref, { value: allocated!.value });
      tx.set(ref, { ...payload, collectedAmount: 0, totalExpenses: 0, laborCost: 0, contractBalance: input.contractValue, netProfit: input.contractValue, createdAt: stamp(), createdBy: user.uid });
    } else {
      tx.update(ref, payload);
    }
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "project.updated" : "project.created",
      module: "projects",
      recordId: ref.id,
      description: existing?.exists ? "Updated a project." : "Created a project.",
      previousValues: existing?.data() ? { status: existing.data()?.status, contractValue: existing.data()?.contractValue } : null,
      newValues: { title: input.title, status: input.status, contractValue: input.contractValue },
    }));
  });
  return ref.id;
}

export async function deleteProject(user: SessionUser, id: string) {
  await live();
  const db = database();
  const [revenue, expenses, taskSnap] = await Promise.all([
    db.collection(collections.revenue).where("projectId", "==", id).limit(1).get(),
    db.collection(collections.expenses).where("projectId", "==", id).limit(1).get(),
    tasks().where("projectId", "==", id).limit(1).get(),
  ]);
  if (!revenue.empty || !expenses.empty || !taskSnap.empty) throw new RecordError("linked");
  const ref = projects().doc(id);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (!existing.exists) throw new RecordError("not_found");
    tx.delete(ref);
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "project.deleted",
      module: "projects",
      recordId: id,
      description: "Deleted a project with no financial records.",
      previousValues: { title: existing.data()?.title, code: existing.data()?.code },
      newValues: null,
    }));
  });
  const related = await members().where("projectId", "==", id).get();
  const allocations = await labor().where("projectId", "==", id).get();
  const batch = db.batch();
  related.docs.forEach((doc) => batch.delete(doc.ref));
  allocations.docs.forEach((doc) => batch.delete(doc.ref));
  if (!related.empty || !allocations.empty) await batch.commit();
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  await live();
  const snapshot = await members().where("projectId", "==", projectId).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    projectId,
    employeeId: asText(doc.data().employeeId),
    role: asText(doc.data().role),
    assignedAt: asIso(doc.data().assignedAt),
  }));
}

export async function assignMember(user: SessionUser, projectId: string, employeeId: string, role: string) {
  await live();
  const db = database();
  const existing = await members().where("projectId", "==", projectId).get();
  if (existing.docs.some((doc) => doc.data().employeeId === employeeId)) throw new RecordError("conflict");
  const ref = members().doc();
  await ref.set({ projectId, employeeId, role, assignedAt: stamp(), createdBy: user.uid });
  await db.collection(collections.activityLogs).add(activityRecord({
    userId: user.uid,
    userName: user.displayName,
    action: "project.updated",
    module: "projects",
    recordId: projectId,
    description: "Assigned a project member.",
    newValues: { employeeId, role },
  }));
}

export async function removeMember(user: SessionUser, id: string) {
  await live();
  const ref = members().doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new RecordError("not_found");
  await ref.delete();
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: user.uid,
    userName: user.displayName,
    action: "project.updated",
    module: "projects",
    recordId: asText(existing.data()?.projectId),
    description: "Removed a project member.",
    previousValues: { employeeId: existing.data()?.employeeId },
  }));
}

export async function listLabor(projectId: string) {
  await live();
  const snapshot = await labor().where("projectId", "==", projectId).limit(200).get();
  return snapshot.docs.map((doc) => mapLabor(doc.id, doc.data()));
}

export async function saveLabor(
  user: SessionUser,
  input: { projectId: string; employeeId: string; date: string; hours: number; hourlyCost: number; description: string; notes: string },
  id?: string,
) {
  await live();
  const db = database();
  const ref = id ? labor().doc(id) : labor().doc();
  const total = laborCost(input.hours, input.hourlyCost);
  await db.runTransaction(async (tx) => {
    const project = await tx.get(projects().doc(input.projectId));
    const employee = await tx.get(employees().doc(input.employeeId));
    const existing = id ? await tx.get(ref) : null;
    if (!project.exists || !employee.exists) throw new RecordError("invalid");
    if (id && !existing?.exists) throw new RecordError("not_found");
    const previous = existing?.exists ? asNumber(existing.data()?.totalCost) : 0;
    const sameProject = !existing?.exists || existing.data()?.projectId === input.projectId;
    if (existing?.exists && !sameProject) {
      const oldProject = await tx.get(projects().doc(asText(existing.data()?.projectId)));
      if (oldProject.exists) tx.update(oldProject.ref, projectFigures(oldProject.data()!, { labor: -previous }));
    }
    const delta = sameProject ? total - previous : total;
    tx.set(ref, { ...input, totalCost: total, updatedAt: stamp(), ...(existing?.exists ? {} : { createdAt: stamp(), createdBy: user.uid }) }, { merge: true });
    tx.update(project.ref, projectFigures(project.data()!, { labor: delta }));
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "labor.updated" : "labor.created",
      module: "projects",
      recordId: ref.id,
      description: "Recorded allocated labor. This is not a cash expense.",
      newValues: { projectId: input.projectId, employeeId: input.employeeId, hours: input.hours, totalCost: total },
    }));
  });
}

export async function deleteLabor(user: SessionUser, id: string) {
  await live();
  const db = database();
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(labor().doc(id));
    if (!existing.exists) throw new RecordError("not_found");
    const project = await tx.get(projects().doc(asText(existing.data()?.projectId)));
    if (project.exists) tx.update(project.ref, projectFigures(project.data()!, { labor: -asNumber(existing.data()?.totalCost) }));
    tx.delete(existing.ref);
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "labor.deleted",
      module: "projects",
      recordId: id,
      description: "Removed an allocated labor record.",
      previousValues: { totalCost: existing.data()?.totalCost },
    }));
  });
}

export async function listTasks(user: SessionUser, filters: { search?: string; status?: string; clientId?: string; assignedToId?: string; cursor?: string | null }) {
  await live();
  const employeeId = user.role === "staff" ? await staffEmployeeId(user) : filters.assignedToId;
  if (user.role === "staff" && !employeeId) return { items: [], nextCursor: null };
  return pageOf(collections.tasks, { ...filters, field: employeeId ? "assignedToId" : filters.clientId ? "clientId" : "status", value: employeeId || filters.clientId || filters.status }, mapTask);
}

export async function tasksFor(field: "clientId" | "projectId" | "assignedToId", id: string) {
  await live();
  const snapshot = await tasks().where(field, "==", id).limit(100).get();
  return snapshot.docs.map((doc) => mapTask(doc.id, doc.data()));
}

export async function staffEmployeeId(user: SessionUser) {
  await live();
  if (user.employeeId) return user.employeeId;
  const snapshot = await employees().where("email", "==", user.email).limit(1).get();
  return snapshot.docs[0]?.id ?? null;
}

export async function saveTask(
  user: SessionUser,
  input: { clientId: string; projectId: string | null; description: string; taskDate: string; givenById: string; assignedToId: string | null; status: TaskStatus; staffNotes: string },
  id?: string,
) {
  await live();
  if (user.role === "staff") {
    if (!id) throw new RecordError("invalid");
    const employeeId = await staffEmployeeId(user);
    const existing = await tasks().doc(id).get();
    if (!existing.exists || existing.data()?.assignedToId !== employeeId) throw new RecordError("not_found");
    await tasks().doc(id).update({ status: input.status, staffNotes: input.staffNotes, updatedAt: stamp() });
    await database().collection(collections.activityLogs).add(activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: "task.updated",
      module: "tasks",
      recordId: id,
      description: "Updated a task status.",
      newValues: { status: input.status },
    }));
    return id;
  }
  const db = database();
  const ref = id ? tasks().doc(id) : tasks().doc();
  await db.runTransaction(async (tx) => {
    const existing = id ? await tx.get(ref) : null;
    if (id && !existing?.exists) throw new RecordError("not_found");
    const allocated = existing?.exists ? null : await allocateCode(tx, "tasks", "TSK");
    const payload = {
      ...input,
      keywords: keywords(input.description, allocated?.code ?? existing?.data()?.code),
      updatedAt: stamp(),
    };
    if (!existing?.exists) {
      tx.set(allocated!.ref, { value: allocated!.value });
      tx.set(ref, { ...payload, code: allocated!.code, createdAt: stamp(), createdBy: user.uid });
    } else {
      tx.update(ref, payload);
    }
    tx.set(db.collection(collections.activityLogs).doc(), activityRecord({
      userId: user.uid,
      userName: user.displayName,
      action: existing?.exists ? "task.updated" : "task.created",
      module: "tasks",
      recordId: ref.id,
      description: existing?.exists ? "Updated a task." : "Created a task.",
      previousValues: existing?.data() ? { status: existing.data()?.status } : null,
      newValues: { status: input.status, description: input.description },
    }));
  });
  return ref.id;
}

export async function deleteTask(user: SessionUser, id: string) {
  await live();
  if (user.role === "staff") throw new RecordError("invalid");
  const ref = tasks().doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new RecordError("not_found");
  await ref.delete();
  await database().collection(collections.activityLogs).add(activityRecord({
    userId: user.uid,
    userName: user.displayName,
    action: "task.deleted",
    module: "tasks",
    recordId: id,
    description: "Deleted a task.",
    previousValues: { description: existing.data()?.description },
  }));
}

export async function listPeopleOptions() {
  await live();
  const [employeeSnap, userSnap] = await Promise.all([
    employees().limit(300).get(),
    users().where("active", "==", true).limit(100).get(),
  ]);
  return {
    employees: employeeSnap.docs.map((doc) => mapEmployee(doc.id, doc.data())),
    users: userSnap.docs.map((doc) => ({ id: doc.id, name: asText(doc.data().displayName), role: asText(doc.data().role) })),
  };
}

export async function clientOptions() {
  await live();
  const snapshot = await clients().orderBy("name").limit(300).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: asText(doc.data().name),
    companyName: asText(doc.data().companyName),
  }));
}

export async function projectOptions() {
  await live();
  const snapshot = await projects().orderBy("title").limit(200).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    title: asText(doc.data().title),
    clientId: asText(doc.data().clientId),
    clientName: asText(doc.data().clientName),
  }));
}

export async function listTaskBoard(
  user: SessionUser,
  filter: "today" | "upcoming" | "overdue" | "mine" | "all" | "completed",
) {
  await live();
  const scoped = user.role === "staff" || filter === "mine";
  const employeeId = scoped ? await staffEmployeeId(user) : null;
  if (scoped && !employeeId) return [];
  const snapshot = employeeId
    ? await tasks().where("assignedToId", "==", employeeId).limit(200).get()
    : await tasks().orderBy("updatedAt", "desc").limit(200).get();
  const today = qatarToday();
  return snapshot.docs
    .map((doc) => mapTask(doc.id, doc.data()))
    .filter((task) => {
      if (filter === "today") return task.taskDate === today;
      if (filter === "upcoming") return task.taskDate > today && task.status !== "completed" && task.status !== "cancelled";
      if (filter === "overdue") return task.taskDate < today && task.status !== "completed" && task.status !== "cancelled";
      if (filter === "completed") return task.status === "completed";
      return true;
    });
}

export { mapProject, projectFigures };
