"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteTaskAction, saveTaskAction } from "@/server/actions/operations";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DateText,
  DialogActions,
  EditorDialog,
  EmptyState,
  Field,
  Panel,
  StatusBadge,
  controlClass,
  requiredError,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { Task, TaskStatus } from "@/types";

const views = ["all", "today", "upcoming", "overdue", "mine", "completed"] as const;
const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "on_hold", "cancelled"];

const schema = z.object({
  clientId: z.string().min(1),
  projectId: z.string(),
  description: z.string().trim().min(1),
  taskDate: z.string().min(10),
  givenById: z.string().min(1),
  assignedToId: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "on_hold", "cancelled"]),
  staffNotes: z.string(),
});

type Values = z.infer<typeof schema>;

export function TasksScreen({
  tasks,
  view,
  clients,
  projects,
  people,
}: {
  tasks: Task[];
  view: (typeof views)[number];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  people: { employees: Array<{ id: string; fullName: string }>; users: Array<{ id: string; name: string }> };
}) {
  const { t } = useI18n();
  const user = useCurrentUser();
  const staff = user.role === "staff";
  const [mode, setMode] = useState<"table" | "board">("table");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {staff ? <p className="text-sm text-muted-foreground">{t("tasks.staffHint")}</p> : null}
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {views.filter((item) => (staff ? item !== "mine" : true)).map((item) => (
              <Button key={item} variant={view === item ? "default" : "outline"} size="sm" render={<a href={`?view=${item}`} />}>
                {t(`tasks.${item}`)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={mode === "table" ? "secondary" : "outline"} size="sm" onClick={() => setMode("table")}>{t("tasks.table")}</Button>
            <Button type="button" variant={mode === "board" ? "secondary" : "outline"} size="sm" onClick={() => setMode("board")}>{t("tasks.board")}</Button>
            {staff ? null : <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("tasks.add")}</Button>}
          </div>
        </div>
      </Panel>
      {tasks.length === 0 ? <EmptyState>{t("tasks.empty")}</EmptyState> : mode === "table" ? (
        <Panel>
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.code")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.description")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.date")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-border">
                  <td className="numeric px-2 py-3">{task.code}</td>
                  <td className="px-2 py-3">
                    <button type="button" className="text-start font-medium text-primary" onClick={() => { setEditing(task); setOpen(true); }}>{task.description}</button>
                  </td>
                  <td className="px-2 py-3"><DateText value={task.taskDate} /></td>
                  <td className="px-2 py-3"><StatusBadge value={task.status} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {statuses.map((status) => (
            <section key={status} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <h2 className="mb-3 text-sm font-medium">{t(`status.${status}`)}</h2>
              <div className="space-y-2">
                {tasks.filter((task) => task.status === status).map((task) => (
                  <button key={task.id} type="button" className="block w-full rounded-lg bg-background p-3 text-start text-sm ring-1 ring-foreground/10" onClick={() => { setEditing(task); setOpen(true); }}>
                    <span className="line-clamp-3">{task.description}</span>
                    <span className="numeric mt-2 block text-xs text-muted-foreground">{task.taskDate}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {open ? (
        <TaskForm
          key={editing?.id ?? "new"}
          task={editing}
          staff={staff}
          clients={clients}
          projects={projects}
          people={people}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TaskForm({
  task,
  staff,
  clients,
  projects,
  people,
  onClose,
}: {
  task: Task | null;
  staff: boolean;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  people: { employees: Array<{ id: string; fullName: string }>; users: Array<{ id: string; name: string }> };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: task ? { ...task, projectId: task.projectId ?? "", assignedToId: task.assignedToId ?? "" } : {
      clientId: clients[0]?.id ?? "",
      projectId: "",
      description: "",
      taskDate: "",
      givenById: people.users[0] ? `user:${people.users[0].id}` : "",
      assignedToId: "",
      status: "pending",
      staffNotes: "",
    },
  });
  const [clientId, setClientId] = useState(task?.clientId ?? clients[0]?.id ?? "");
  const clientField = form.register("clientId");

  async function onSubmit(values: Values) {
    const result = await saveTaskAction({
      ...values,
      projectId: values.projectId || null,
      assignedToId: values.assignedToId || null,
    }, task?.id);
    await finish(result, onClose);
  }

  async function remove() {
    if (!task) return;
    const result = await deleteTaskAction(task.id);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={task ? t("tasks.edit") : t("tasks.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label={t("fields.description")} error={requiredError(Boolean(form.formState.errors.description), t("validation.required"))}>
          <textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" disabled={staff} {...form.register("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.client")}>
            <select className={controlClass} disabled={staff} {...clientField} onChange={(event) => { setClientId(event.target.value); void clientField.onChange(event); }}>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </Field>
          <Field label={t("fields.project")}>
            <select className={controlClass} disabled={staff} {...form.register("projectId")}>
              <option value="">{t("common.none")}</option>
              {projects.filter((project) => project.clientId === clientId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </Field>
          <Field label={t("fields.date")}><Input className="numeric h-10" type="date" disabled={staff} {...form.register("taskDate")} /></Field>
          <Field label={t("fields.status")}>
            <select className={controlClass} {...form.register("status")}>
              {statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.givenBy")}>
            <select className={controlClass} disabled={staff} {...form.register("givenById")}>
              {people.users.map((person) => <option key={person.id} value={`user:${person.id}`}>{person.name}</option>)}
              {people.employees.map((person) => <option key={person.id} value={`employee:${person.id}`}>{person.fullName}</option>)}
            </select>
          </Field>
          <Field label={t("fields.assignedTo")}>
            <select className={controlClass} disabled={staff} {...form.register("assignedToId")}>
              <option value="">{t("common.none")}</option>
              {people.employees.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("fields.staffNotes")}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register("staffNotes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
        {task && !staff ? <Button type="button" variant="destructive" onClick={() => void remove()}>{t("common.delete")}</Button> : null}
      </form>
    </EditorDialog>
  );
}
