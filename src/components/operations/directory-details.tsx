"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientForm } from "@/components/operations/clients-screen";
import { EmployeeForm } from "@/components/operations/employees-screen";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DataTable, DateText, Money, Panel, StatusBadge } from "@/components/records/widgets";
import type { Client, Employee, Project, Revenue, Task } from "@/types";

export function ClientDetail({
  client,
  projects,
  revenue,
  tasks,
}: {
  client: Client;
  projects: Project[];
  revenue: Revenue[];
  tasks: Task[];
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"projects" | "revenue" | "tasks">("projects");
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="numeric text-sm text-muted-foreground">{client.code}</p>
          <h2 className="break-words text-xl font-semibold">{client.name}</h2>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
      </div>
      <Panel>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Info label={t("fields.company")} value={client.companyName} />
          <Info label={t("fields.contact")} value={client.contactPerson} />
          <Info label={t("fields.mobile")} value={client.mobile} />
          <Info label={t("common.email")} value={client.email} />
          <div>
            <dt className="text-muted-foreground">{t("fields.status")}</dt>
            <dd className="mt-1"><StatusBadge value={client.status} /></dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t("fields.notes")}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{client.notes || "—"}</dd>
          </div>
        </dl>
      </Panel>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {(["projects", "revenue", "tasks"] as const).map((item) => (
          <Button key={item} type="button" size="sm" className="shrink-0" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
            {t(`clients.${item}`)}
          </Button>
        ))}
      </div>
      {tab === "projects" ? <Links rows={projects.map((project) => ({ id: project.id, href: `/operations/projects/${project.id}`, title: project.title, extra: project.status }))} empty={t("projects.empty")} /> : null}
      {tab === "revenue" ? (
        <Panel className="min-w-0 overflow-hidden">
          <DataTable>
            <tbody>
              {revenue.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-2 py-2">{item.description}</td>
                  <td className="px-2 py-2"><DateText value={item.date} /></td>
                  <td className="px-2 py-2"><Money amount={item.amount} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {revenue.length === 0 ? <p className="text-sm text-muted-foreground">{t("revenue.empty")}</p> : null}
        </Panel>
      ) : null}
      {tab === "tasks" ? <Links rows={tasks.map((task) => ({ id: task.id, href: "/operations/tasks", title: task.description, extra: task.status }))} empty={t("tasks.empty")} /> : null}
      {editing ? <ClientForm open client={client} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

export function EmployeeDetail({ employee, tasks }: { employee: Employee; tasks: Task[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="numeric text-sm text-muted-foreground">{employee.code}</p>
          <h2 className="break-words text-xl font-semibold">{employee.fullName}</h2>
          <p className="break-words text-sm text-muted-foreground">{employee.position}</p>
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
      </div>
      <Panel>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Info label={t("common.email")} value={employee.email} />
          <Info label={t("fields.mobile")} value={employee.mobile} />
          <Info label={t("fields.position")} value={employee.position} />
          <Info label={t("fields.type")} value={t(`status.${employee.type}`)} />
          <div>
            <dt className="text-muted-foreground">{t("fields.startDate")}</dt>
            <dd className="mt-1"><DateText value={employee.startDate} /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("fields.status")}</dt>
            <dd className="mt-1"><StatusBadge value={employee.workingStatus} /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("fields.salary")}</dt>
            <dd className="mt-1"><Money amount={employee.basicSalary} /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("fields.hourlyCost")}</dt>
            <dd className="mt-1"><Money amount={employee.hourlyCost} /></dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t("fields.notes")}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{employee.notes || "—"}</dd>
          </div>
        </dl>
      </Panel>
      <p className="text-sm text-muted-foreground">{t("employees.inactiveHint")}</p>
      <Panel>
        <h3 className="mb-3 font-medium">{t("nav.tasks")}</h3>
        <ul className="space-y-2 text-sm">
          {tasks.map((task) => <li key={task.id} className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span className="min-w-0 break-words">{task.description}</span><StatusBadge value={task.status} /></li>)}
          {tasks.length === 0 ? <li className="text-muted-foreground">{t("tasks.empty")}</li> : null}
        </ul>
      </Panel>
      {editing ? <EmployeeForm key={employee.updatedAt} employee={employee} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>;
}

function Links({ rows, empty }: { rows: Array<{ id: string; href: string; title: string; extra: string }>; empty: string }) {
  return (
    <Panel>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Link className="min-w-0 break-words text-primary" href={row.href}>{row.title}</Link>
            <StatusBadge value={row.extra} />
          </li>
        ))}
        {rows.length === 0 ? <li className="text-muted-foreground">{empty}</li> : null}
      </ul>
    </Panel>
  );
}
