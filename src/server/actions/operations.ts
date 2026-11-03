"use server";

import { z } from "zod";
import { authorized } from "@/server/actions/guard";
import {
  assignMember,
  deleteLabor,
  deleteProject,
  deleteTask,
  removeMember,
  saveClient,
  saveEmployee,
  saveLabor,
  saveProject,
  saveTask,
} from "@/server/services/directory";
import type { ClientStatus, ContractType, EmployeeType, ProjectStatus, TaskStatus, WorkingStatus } from "@/types";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.coerce.number().finite().min(0);
const optionalId = z.union([z.string().trim().min(1).max(120), z.literal(""), z.null()]).optional().transform((value) => value || null);

const clientSchema = z.object({
  name: required(160),
  companyName: text(160),
  contactPerson: text(160),
  mobile: text(40),
  email: text(160),
  status: z.enum(["active", "inactive", "potential", "archived"]),
  notes: text(4000),
});

const employeeSchema = z.object({
  fullName: required(160),
  email: text(160),
  mobile: text(40),
  position: text(120),
  type: z.enum(["staff", "worker", "freelancer", "contractor"]),
  startDate: date,
  basicSalary: money,
  hourlyCost: money,
  workingStatus: z.enum(["office", "remote", "inactive"]),
  notes: text(4000),
  photoURL: optionalId,
});

const projectSchema = z.object({
  title: required(180),
  clientId: required(120),
  typeId: required(120),
  contractValue: money,
  startDate: date,
  plannedDeliveryDate: date,
  actualDeliveryDate: optionalId,
  status: z.enum(["pending", "in_progress", "on_hold", "completed", "cancelled"]),
  contractType: z.enum(["monthly", "one_time", "special"]),
  notes: text(4000),
});

const taskSchema = z.object({
  clientId: required(120),
  projectId: optionalId,
  description: required(1000),
  taskDate: date,
  givenById: required(160),
  assignedToId: optionalId,
  status: z.enum(["pending", "in_progress", "completed", "on_hold", "cancelled"]),
  staffNotes: text(4000),
});

const laborSchema = z.object({
  projectId: required(120),
  employeeId: required(120),
  date,
  hours: z.coerce.number().finite().positive(),
  hourlyCost: money,
  description: text(300),
  notes: text(1000),
});

export async function saveClientAction(input: unknown, id?: string) {
  const data = clientSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("operations.view", (user) => saveClient(user, data.data as {
    name: string;
    companyName: string;
    contactPerson: string;
    mobile: string;
    email: string;
    status: ClientStatus;
    notes: string;
  }, id));
}

export async function saveEmployeeAction(input: unknown, id?: string) {
  const data = employeeSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("operations.view", (user) => saveEmployee(user, {
    ...data.data,
    type: data.data.type as EmployeeType,
    workingStatus: data.data.workingStatus as WorkingStatus,
    photoURL: data.data.photoURL ?? null,
  }, id));
}

export async function saveProjectAction(input: unknown, id?: string) {
  const data = projectSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("operations.view", (user) => saveProject(user, {
    ...data.data,
    actualDeliveryDate: data.data.actualDeliveryDate,
    status: data.data.status as ProjectStatus,
    contractType: data.data.contractType as ContractType,
  }, id));
}

export async function deleteProjectAction(id: string) {
  return authorized("operations.view", (user) => deleteProject(user, id).then(() => null));
}

export async function saveTaskAction(input: unknown, id?: string) {
  const data = taskSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("tasks.view", (user) => saveTask(user, {
    ...data.data,
    projectId: data.data.projectId,
    assignedToId: data.data.assignedToId,
    status: data.data.status as TaskStatus,
  }, id));
}

export async function deleteTaskAction(id: string) {
  return authorized("tasks.view", (user) => deleteTask(user, id).then(() => null));
}

export async function saveLaborAction(input: unknown, id?: string) {
  const data = laborSchema.safeParse(input);
  if (!data.success) return { ok: false, error: "invalid" } as const;
  return authorized("operations.view", (user) => saveLabor(user, data.data, id).then(() => null));
}

export async function deleteLaborAction(id: string) {
  return authorized("operations.view", (user) => deleteLabor(user, id).then(() => null));
}

export async function assignMemberAction(projectId: string, employeeId: string, role: string) {
  const parsedRole = text(80).safeParse(role);
  if (!parsedRole.success || !projectId || !employeeId) return { ok: false, error: "invalid" } as const;
  return authorized("operations.view", (user) => assignMember(user, projectId, employeeId, parsedRole.data).then(() => null));
}

export async function removeMemberAction(id: string) {
  return authorized("operations.view", (user) => removeMember(user, id).then(() => null));
}
