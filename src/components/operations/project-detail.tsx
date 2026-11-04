"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { assignMemberAction, deleteLaborAction, deleteProjectAction, removeMemberAction, saveLaborAction } from "@/server/actions/operations";
import { ProjectForm } from "@/components/operations/projects-screen";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DateText,
  DialogActions,
  EditorDialog,
  Field,
  Money,
  Panel,
  StatusBadge,
  localizedName,
  controlClass,
  useSavedRefresh,
} from "@/components/records/widgets";
import { cn } from "@/lib/utils";
import type { Category, Expense, LaborAllocation, Project, ProjectMember, Revenue, Task } from "@/types";

const tabs = ["overview", "financials", "expenses", "revenue", "tasks", "team", "notes"] as const;

export function ProjectDetail({
  project,
  clients,
  types,
  expenses,
  revenue,
  tasks,
  members,
  labor,
  employees,
}: {
  project: Project;
  clients: Array<{ id: string; name: string }>;
  types: Category[];
  expenses: Expense[];
  revenue: Revenue[];
  tasks: Task[];
  members: ProjectMember[];
  labor: LaborAllocation[];
  employees: Array<{ id: string; fullName: string; hourlyCost: number }>;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
  const [editing, setEditing] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const { error, finish } = useSavedRefresh();
  const names = new Map(employees.map((employee) => [employee.id, employee.fullName]));

  async function removeProject() {
    const result = await deleteProjectAction(project.id);
    if (result.ok) {
      router.push("/operations/projects");
      router.refresh();
      return;
    }
    await finish(result);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="numeric text-sm text-muted-foreground">{project.code}</p>
          <h2 className="text-xl font-semibold">{project.title}</h2>
          <p className="text-sm text-muted-foreground">{project.clientName}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
          <Button type="button" variant="destructive" onClick={() => void removeProject()}>{t("projects.remove")}</Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <Button key={item} type="button" size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
            {t(`projects.${item}`)}
          </Button>
        ))}
      </div>
      {tab === "overview" || tab === "financials" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label={t("fields.contractValue")} amount={project.contractValue} />
          <Metric label={t("fields.collected")} amount={project.collectedAmount} />
          <Metric label={t("fields.contractBalance")} amount={project.contractBalance} />
          <Metric label={t("fields.amount")} amount={project.totalExpenses} hint={t("nav.expenses")} />
          <Metric label={t("fields.labor")} amount={project.laborCost} />
          <Metric label={t("fields.netProfit")} amount={project.netProfit} />
        </div>
      ) : null}
      {tab === "financials" ? <p className="text-sm leading-6 text-muted-foreground">{t("projects.profitHint")}</p> : null}
      {tab === "expenses" ? <MoneyRows rows={expenses.map((item) => ({ id: item.id, title: item.title, amount: item.amount, date: item.dueDate, status: item.status }))} /> : null}
      {tab === "revenue" ? <MoneyRows rows={revenue.map((item) => ({ id: item.id, title: item.description, amount: item.amount, date: item.date, status: item.status }))} /> : null}
      {tab === "tasks" ? (
        <Panel>
          <ul className="space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3">
                <span>{task.description}</span>
                <StatusBadge value={task.status} />
              </li>
            ))}
            {tasks.length === 0 ? <li className="text-muted-foreground">{t("tasks.empty")}</li> : null}
          </ul>
        </Panel>
      ) : null}
      {tab === "team" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">{t("projects.team")}</h3>
            </div>
            <MemberForm projectId={project.id} employees={employees} memberIds={members.map((member) => member.employeeId)} />
            <ul className="mt-4 divide-y divide-[#550000]/10 text-sm">
              {members.map((member) => (
                <li key={member.id} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-3 py-2">
                  <span className="truncate">{names.get(member.employeeId) ?? member.employeeId}</span>
                  <span className="truncate text-muted-foreground">{member.role || "—"}</span>
                  <RemoveMember id={member.id} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">{t("fields.labor")}</h3>
              <Button type="button" size="sm" onClick={() => setLaborOpen(true)}>{t("projects.labor")}</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-[28%] px-2 py-2 text-start font-medium">{t("fields.employee")}</th>
                    <th className="w-[22%] px-2 py-2 text-start font-medium">{t("fields.date")}</th>
                    <th className="w-[14%] px-2 py-2 text-start font-medium">{t("fields.hours")}</th>
                    <th className="w-[20%] px-2 py-2 text-start font-medium">{t("fields.labor")}</th>
                    <th className="w-[16%] px-2 py-2 text-start font-medium">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {labor.map((item) => (
                    <tr key={item.id} className="border-t border-[#550000]/10">
                      <td className="px-2 py-2 text-start">{names.get(item.employeeId) ?? item.employeeId}</td>
                      <td className="px-2 py-2 text-start"><DateText value={item.date} /></td>
                      <td className="numeric px-2 py-2 text-start">{item.hours}</td>
                      <td className="px-2 py-2 text-start"><Money amount={item.totalCost} /></td>
                      <td className="px-2 py-2 text-start"><RemoveLabor id={item.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {labor.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("common.empty")}</p> : null}
          </Panel>
        </div>
      ) : null}
      {tab === "notes" ? <Panel><p className="whitespace-pre-wrap text-sm leading-6">{project.notes || "—"}</p></Panel> : null}
      {tab === "overview" ? (
        <Panel>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t("fields.client")}</dt><dd className="mt-1"><Link className="text-primary" href={`/operations/clients/${project.clientId}`}>{project.clientName}</Link></dd></div>
            <div><dt className="text-muted-foreground">{t("fields.type")}</dt><dd className="mt-1">{localizedName(types.find((type) => type.id === project.typeId)?.name ?? { en: "", ar: "" }, locale) || "—"}</dd></div>
            <div><dt className="text-muted-foreground">{t("fields.contractValue")}</dt><dd className="mt-1"><Money amount={project.contractValue} /></dd></div>
            <div><dt className="text-muted-foreground">{t("fields.contractType")}</dt><dd className="mt-1">{t(`status.${project.contractType}`)}</dd></div>
            <div><dt className="text-muted-foreground">{t("fields.startDate")}</dt><dd className="mt-1"><DateText value={project.startDate} /></dd></div>
            <div><dt className="text-muted-foreground">{t("fields.plannedDelivery")}</dt><dd className="mt-1"><DateText value={project.plannedDeliveryDate} /></dd></div>
            <div><dt className="text-muted-foreground">{t("fields.actualDelivery")}</dt><dd className="mt-1"><DateText value={project.actualDeliveryDate} /></dd></div>
            <div><dt className="text-muted-foreground">{t("fields.status")}</dt><dd className="mt-1"><StatusBadge value={project.status} /></dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">{t("fields.notes")}</dt><dd className="mt-1 whitespace-pre-wrap">{project.notes || "—"}</dd></div>
          </dl>
        </Panel>
      ) : null}
      {editing ? <ProjectForm project={project} clients={clients} types={types} onClose={() => setEditing(false)} /> : null}
      {laborOpen ? <LaborForm projectId={project.id} employees={employees} onClose={() => setLaborOpen(false)} /> : null}
    </div>
  );
}

function Metric({ label, amount }: { label: string; amount: number; hint?: string }) {
  return (
    <Panel>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold"><Money amount={amount} /></p>
    </Panel>
  );
}

function MoneyRows({ rows }: { rows: Array<{ id: string; title: string; amount: number; date: string; status: string }> }) {
  const { t } = useI18n();
  return (
    <Panel>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
        <DataTable>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-2 py-2">{row.title}</td>
                <td className="px-2 py-2"><DateText value={row.date} /></td>
                <td className="px-2 py-2"><Money amount={row.amount} /></td>
                <td className="px-2 py-2"><StatusBadge value={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}

function MemberForm({ projectId, employees, memberIds }: { projectId: string; employees: Array<{ id: string; fullName: string }>; memberIds: string[] }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const available = employees.filter((employee) => !memberIds.includes(employee.id));
  const [employeeId, setEmployeeId] = useState(available[0]?.id ?? "");
  const [role, setRole] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await assignMemberAction(projectId, employeeId, role);
    await finish(result);
  }

  return (
    <form className="flex flex-wrap items-center gap-3" onSubmit={(event) => void submit(event)}>
      <select className={cn(controlClass, "w-auto min-w-48 flex-1")} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} aria-label={t("fields.employee")}>
        {available.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
      </select>
      <Input className="h-10 w-40" value={role} onChange={(event) => setRole(event.target.value)} placeholder={t("fields.role")} aria-label={t("fields.role")} />
      <Button type="submit" className="h-10 shrink-0 px-5" disabled={!employeeId}>{t("projects.assign")}</Button>
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function RemoveMember({ id }: { id: string }) {
  const { t } = useI18n();
  const { finish } = useSavedRefresh();
  return <Button type="button" variant="ghost" size="sm" onClick={() => void finish(removeMemberAction(id))}>{t("common.delete")}</Button>;
}

function RemoveLabor({ id }: { id: string }) {
  const { t } = useI18n();
  const { finish } = useSavedRefresh();
  return <Button type="button" variant="ghost" size="sm" onClick={() => void finish(deleteLaborAction(id))}>{t("common.delete")}</Button>;
}

const laborSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(10),
  hours: z.coerce.number().positive(),
  hourlyCost: z.coerce.number().min(0),
  description: z.string(),
  notes: z.string(),
});

function LaborForm({ projectId, employees, onClose }: { projectId: string; employees: Array<{ id: string; fullName: string; hourlyCost: number }>; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<z.infer<typeof laborSchema>>({
    resolver: zodResolver(laborSchema) as never,
    defaultValues: { employeeId: employees[0]?.id ?? "", date: "", hours: 1, hourlyCost: employees[0]?.hourlyCost ?? 0, description: "", notes: "" },
  });

  async function onSubmit(values: z.infer<typeof laborSchema>) {
    const result = await saveLaborAction({ ...values, projectId });
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={t("projects.labor")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{t("projects.profitHint")}</p>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field label={t("fields.employee")}>
          <select className={controlClass} {...form.register("employeeId")} onChange={(event) => {
            form.setValue("employeeId", event.target.value);
            const employee = employees.find((item) => item.id === event.target.value);
            if (employee) form.setValue("hourlyCost", employee.hourlyCost);
          }}>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("fields.date")}><Input className="numeric h-10" type="date" {...form.register("date")} /></Field>
          <Field label={t("fields.hours")}><Input className="numeric h-10" type="number" min="0.25" step="0.25" {...form.register("hours")} /></Field>
          <Field label={t("fields.hourlyCost")}><Input className="numeric h-10" type="number" min="0" step="0.01" {...form.register("hourlyCost")} /></Field>
        </div>
        <Field label={t("fields.description")}><Input className="h-10" {...form.register("description")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
