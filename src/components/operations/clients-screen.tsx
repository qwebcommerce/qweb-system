"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveClientAction } from "@/server/actions/operations";
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
  Pager,
  Panel,
  StatusBadge,
  controlClass,
  requiredError,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { Client, ClientStatus } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1),
  companyName: z.string().trim(),
  contactPerson: z.string().trim(),
  mobile: z.string().trim(),
  email: z.string().trim(),
  status: z.enum(["active", "inactive", "potential", "archived"]),
  notes: z.string().trim(),
});

type Values = z.infer<typeof schema>;

export function ClientsScreen({
  page,
  query,
}: {
  page: { items: Client[]; nextCursor: string | null };
  query: { q?: string; status?: string; cursor?: string };
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form className="grid flex-1 gap-3 sm:grid-cols-[1fr_10rem_auto]" method="get">
            <Input name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <StatusSelect value={query.status} />
            <Button type="submit" variant="outline">{t("common.search")}</Button>
          </form>
          <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("clients.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("clients.empty")}</EmptyState> : (
        <Panel>
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.code")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.name")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.company")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.status")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.date")}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((client) => (
                <tr key={client.id} className="border-t border-border">
                  <td className="numeric px-2 py-3">{client.code}</td>
                  <td className="px-2 py-3">
                    <Link className="font-medium text-primary" href={`/operations/clients/${client.id}`}>{client.name}</Link>
                  </td>
                  <td className="px-2 py-3">{client.companyName || "—"}</td>
                  <td className="px-2 py-3"><StatusBadge value={client.status} /></td>
                  <td className="px-2 py-3"><DateText value={client.updatedAt} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pager cursor={page.nextCursor} query={query} />
        </Panel>
      )}
      {open ? <ClientForm key={editing?.id ?? "new"} open client={editing} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export function ClientForm({ open, client, onClose }: { open: boolean; client: Client | null; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: client ?? { name: "", companyName: "", contactPerson: "", mobile: "", email: "", status: "active", notes: "" },
  });

  async function onSubmit(values: Values) {
    const result = await saveClientAction(values, client?.id);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open={open} title={client ? t("clients.edit") : t("clients.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label={t("fields.name")} error={requiredError(Boolean(form.formState.errors.name), t("validation.required"))}>
          <Input className="h-10" {...form.register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.company")}><Input className="h-10" {...form.register("companyName")} /></Field>
          <Field label={t("fields.contact")}><Input className="h-10" {...form.register("contactPerson")} /></Field>
          <Field label={t("fields.mobile")}><Input className="numeric h-10" {...form.register("mobile")} /></Field>
          <Field label={t("common.email")}><Input className="h-10" {...form.register("email")} /></Field>
        </div>
        <Field label={t("fields.status")}>
          <select className={controlClass} {...form.register("status")}>
            {(["active", "inactive", "potential", "archived"] as ClientStatus[]).map((status) => (
              <option key={status} value={status}>{t(`status.${status}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("fields.notes")}><textarea className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function StatusSelect({ value }: { value?: string }) {
  const { t } = useI18n();
  return (
    <select className={controlClass} name="status" defaultValue={value ?? "all"} aria-label={t("fields.status")}>
      <option value="all">{t("common.all")}</option>
      {(["active", "inactive", "potential", "archived"] as const).map((status) => (
        <option key={status} value={status}>{t(`status.${status}`)}</option>
      ))}
    </select>
  );
}
