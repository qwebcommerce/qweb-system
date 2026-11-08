"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteTaskAction, saveTaskAction } from "@/server/actions/operations";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
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
  const { error, finish } = useSavedRefresh();
  const [editing, setEditing] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function remove() {
    if (!removing || staff) return;
    setPendingDelete(true);
    const result = await deleteTaskAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {staff ? <p className="text-sm text-muted-foreground">{t("tasks.staffHint")}</p> : null}
      <Panel className="p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {views.filter((item) => (staff ? item !== "mine" : true)).map((item) => (
              <Button key={item} variant={view === item ? "default" : "outline"} size="sm" render={<a href={`?view=${item}`} />}>
                {t(`tasks.${item}`)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button type="button" variant={mode === "table" ? "secondary" : "outline"} size="sm" className="w-full sm:w-auto" onClick={() => setMode("table")}>{t("tasks.table")}</Button>
            <Button type="button" variant={mode === "board" ? "secondary" : "outline"} size="sm" className="w-full sm:w-auto" onClick={() => setMode("board")}>{t("tasks.board")}</Button>
            {staff ? null : <Button type="button" className="col-span-2 h-10 w-full px-6 sm:col-span-1 sm:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>{t("tasks.add")}</Button>}
          </div>
        </div>
      </Panel>
      {tasks.length === 0 ? <EmptyState>{t("tasks.empty")}</EmptyState> : mode === "table" ? (
        <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[44rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.code")}</th>
                  <th className="w-[36%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.description")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.date")}</th>
                  <th className="w-[14%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.status")}</th>
                  <th className="w-[22%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-[#550000]/10">
                    <td className="numeric px-3 py-3 text-start whitespace-nowrap md:px-5">{task.code}</td>
                    <td className="px-3 py-3 text-start break-words md:px-5">{task.description}</td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><DateText value={task.taskDate} /></td>
                    <td className="px-3 py-3 text-start md:px-5"><StatusBadge value={task.status} /></td>
                    <td className="px-3 py-3 text-start md:px-5">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setViewing(task)}>{t("common.view")}</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(task); setOpen(true); }}>{t("common.edit")}</Button>
                        {staff ? null : <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(task)}>{t("common.delete")}</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
      {!removing && error ? <p className="text-sm text-destructive">{error}</p> : null}
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
      {viewing ? (
        <TaskView task={viewing} clients={clients} projects={projects} people={people} onClose={() => setViewing(null)} />
      ) : null}
      {removing ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{t("tasks.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.description}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pendingDelete} onClick={() => setRemoving(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={pendingDelete} onClick={() => void remove()}>{t("common.delete")}</Button>
          </DialogFooter>
        </EditorDialog>
      ) : null}
    </div>
  );
}

function personName(
  id: string | null,
  people: { employees: Array<{ id: string; fullName: string }>; users: Array<{ id: string; name: string }> },
) {
  if (!id) return "";
  if (id.startsWith("user:")) return people.users.find((person) => person.id === id.slice(5))?.name ?? "";
  const employeeId = id.startsWith("employee:") ? id.slice(9) : id;
  return people.employees.find((person) => person.id === employeeId)?.fullName ?? "";
}

function TaskView({
  task,
  clients,
  projects,
  people,
  onClose,
}: {
  task: Task;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  people: { employees: Array<{ id: string; fullName: string }>; users: Array<{ id: string; name: string }> };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const client = clients.find((item) => item.id === task.clientId)?.name ?? "";
  const project = projects.find((item) => item.id === task.projectId)?.title ?? "";
  return (
    <EditorDialog open title={task.code} onClose={onClose}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t("fields.description")}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{task.description}</dd>
        </div>
        <Detail label={t("fields.client")} value={client} />
        <Detail label={t("fields.project")} value={project} />
        <div>
          <dt className="text-muted-foreground">{t("fields.date")}</dt>
          <dd className="mt-1"><DateText value={task.taskDate} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.status")}</dt>
          <dd className="mt-1"><StatusBadge value={task.status} /></dd>
        </div>
        <Detail label={t("fields.givenBy")} value={personName(task.givenById, people)} />
        <Detail label={t("fields.assignedTo")} value={personName(task.assignedToId, people)} />
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t("fields.staffNotes")}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{task.staffNotes || "—"}</dd>
        </div>
      </dl>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.close")}</Button>
      </DialogFooter>
    </EditorDialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value || "—"}</dd>
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
          <Field label={t("fields.date")}><Input className="numeric h-10 w-full min-w-0 max-w-full" type="date" disabled={staff} {...form.register("taskDate")} /></Field>
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
