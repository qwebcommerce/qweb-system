"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteProjectAction, saveProjectAction } from "@/server/actions/operations";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DialogActions,
  EditorDialog,
  EmptyState,
  Field,
  Money,
  Pager,
  Panel,
  StatusBadge,
  controlClass,
  localizedName,
  requiredError,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { Category, ContractType, Project, ProjectStatus } from "@/types";

const schema = z.object({
  title: z.string().trim().min(1),
  clientId: z.string().min(1),
  typeId: z.string().min(1),
  contractValue: z.coerce.number().min(0),
  startDate: z.string().min(10),
  plannedDeliveryDate: z.string().min(10),
  actualDeliveryDate: z.string(),
  status: z.enum(["pending", "in_progress", "on_hold", "completed", "cancelled"]),
  contractType: z.enum(["monthly", "one_time", "special"]),
  notes: z.string(),
});

type Values = z.infer<typeof schema>;

export function ProjectsScreen({
  page,
  query,
  clients,
  types,
}: {
  page: { items: Project[]; nextCursor: string | null };
  query: { q?: string; status?: string; cursor?: string };
  clients: Array<{ id: string; name: string }>;
  types: Category[];
}) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function remove() {
    if (!removing) return;
    setPendingDelete(true);
    const result = await deleteProjectAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <form className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center" method="get">
            <Input className="h-10 w-full sm:max-w-sm" name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={`${controlClass} sm:w-48`} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {(["pending", "in_progress", "on_hold", "completed", "cancelled"] as const).map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
            <Button type="submit" variant="outline" className="h-10 shrink-0 px-6">{t("common.search")}</Button>
          </form>
          <Button type="button" className="h-10 shrink-0 px-6" onClick={() => { setEditing(null); setOpen(true); }}>{t("projects.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("projects.empty")}</EmptyState> : (
        <Panel className="overflow-hidden p-0 md:p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[10%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.code")}</th>
                  <th className="w-[18%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.title")}</th>
                  <th className="w-[16%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.client")}</th>
                  <th className="w-[12%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.contractValue")}</th>
                  <th className="w-[12%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.collected")}</th>
                  <th className="w-[10%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.status")}</th>
                  <th className="w-[22%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((project) => (
                  <tr key={project.id} className="border-t border-[#550000]/10">
                    <td className="numeric px-5 py-3 text-start">{project.code}</td>
                    <td className="px-5 py-3 text-start"><Link className="font-medium text-primary" href={`/operations/projects/${project.id}`}>{project.title}</Link></td>
                    <td className="px-5 py-3 text-start">{project.clientName}</td>
                    <td className="px-5 py-3 text-start"><Money amount={project.contractValue} /></td>
                    <td className="px-5 py-3 text-start"><Money amount={project.collectedAmount} /></td>
                    <td className="px-5 py-3 text-start"><StatusBadge value={project.status} /></td>
                    <td className="px-5 py-3 text-start">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="sm" render={<Link href={`/operations/projects/${project.id}`} />}>{t("common.view")}</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(project); setOpen(true); }}>{t("common.edit")}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(project)}>{t("common.delete")}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pager cursor={page.nextCursor} query={query} />
          </div>
        </Panel>
      )}
      {!removing && error ? <p className="text-sm text-destructive">{error}</p> : null}
      {open ? <ProjectForm key={editing?.id ?? "new"} clients={clients} types={types} project={editing} onClose={() => setOpen(false)} /> : null}
      {removing ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{t("projects.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.title}</p>
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

export function ProjectForm({
  project,
  clients,
  types,
  onClose,
}: {
  project: Project | null;
  clients: Array<{ id: string; name: string }>;
  types: Category[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: project ? {
      ...project,
      actualDeliveryDate: project.actualDeliveryDate ?? "",
    } : {
      title: "",
      clientId: clients[0]?.id ?? "",
      typeId: types[0]?.id ?? "",
      contractValue: 0,
      startDate: "",
      plannedDeliveryDate: "",
      actualDeliveryDate: "",
      status: "pending",
      contractType: "one_time",
      notes: "",
    },
  });

  async function onSubmit(values: Values) {
    const result = await saveProjectAction({ ...values, actualDeliveryDate: values.actualDeliveryDate || null }, project?.id);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={project ? t("projects.edit") : t("projects.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label={t("fields.title")} error={requiredError(Boolean(form.formState.errors.title), t("validation.required"))}>
          <Input className="h-10" {...form.register("title")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.client")}>
            <select className={controlClass} {...form.register("clientId")}>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </Field>
          <Field label={t("fields.type")}>
            <select className={controlClass} {...form.register("typeId")}>
              {types.map((type) => <option key={type.id} value={type.id}>{localizedName(type.name, locale)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.contractValue")}><Input className="numeric h-10" type="number" min="0" step="0.01" {...form.register("contractValue")} /></Field>
          <Field label={t("fields.contractType")}>
            <select className={controlClass} {...form.register("contractType")}>
              {(["one_time", "monthly", "special"] as ContractType[]).map((type) => <option key={type} value={type}>{t(`status.${type}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.startDate")}><Input className="numeric h-10" type="date" {...form.register("startDate")} /></Field>
          <Field label={t("fields.plannedDelivery")}><Input className="numeric h-10" type="date" {...form.register("plannedDeliveryDate")} /></Field>
          <Field label={t("fields.actualDelivery")}><Input className="numeric h-10" type="date" {...form.register("actualDeliveryDate")} /></Field>
          <Field label={t("fields.status")}>
            <select className={controlClass} {...form.register("status")}>
              {(["pending", "in_progress", "on_hold", "completed", "cancelled"] as ProjectStatus[]).map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("fields.notes")}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
