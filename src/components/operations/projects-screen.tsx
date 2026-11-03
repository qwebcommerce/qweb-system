"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveProjectAction } from "@/server/actions/operations";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form className="grid flex-1 gap-3 sm:grid-cols-[1fr_11rem_auto]" method="get">
            <Input name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={controlClass} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {(["pending", "in_progress", "on_hold", "completed", "cancelled"] as const).map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
            <Button type="submit" variant="outline">{t("common.search")}</Button>
          </form>
          <Button type="button" onClick={() => setOpen(true)}>{t("projects.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("projects.empty")}</EmptyState> : (
        <Panel>
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.code")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.title")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.client")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.contractValue")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.collected")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((project) => (
                <tr key={project.id} className="border-t border-border">
                  <td className="numeric px-2 py-3">{project.code}</td>
                  <td className="px-2 py-3"><Link className="font-medium text-primary" href={`/operations/projects/${project.id}`}>{project.title}</Link></td>
                  <td className="px-2 py-3">{project.clientName}</td>
                  <td className="px-2 py-3"><Money amount={project.contractValue} /></td>
                  <td className="px-2 py-3"><Money amount={project.collectedAmount} /></td>
                  <td className="px-2 py-3"><StatusBadge value={project.status} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pager cursor={page.nextCursor} query={query} />
        </Panel>
      )}
      {open ? <ProjectForm clients={clients} types={types} project={null} onClose={() => setOpen(false)} /> : null}
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
