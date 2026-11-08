"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteClientAction, saveClientAction } from "@/server/actions/operations";
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
  const { error, finish } = useSavedRefresh();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [removing, setRemoving] = useState<Client | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function remove() {
    if (!removing) return;
    setPendingDelete(true);
    const result = await deleteClientAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <Panel className="p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
          <form className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-center" method="get">
            <Input className="h-10 w-full min-w-0 sm:col-span-2 lg:col-span-1" name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <StatusSelect value={query.status} />
            <Button type="submit" variant="outline" className="h-10 w-full px-6 sm:col-span-2 lg:col-span-1 lg:w-auto">{t("common.search")}</Button>
          </form>
          <Button type="button" className="h-10 w-full px-6 lg:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>{t("clients.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("clients.empty")}</EmptyState> : (
        <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.code")}</th>
                  <th className="w-[18%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.name")}</th>
                  <th className="w-[18%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.company")}</th>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.status")}</th>
                  <th className="w-[14%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.date")}</th>
                  <th className="w-[26%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((client) => (
                  <tr key={client.id} className="border-t border-[#550000]/10">
                    <td className="numeric px-3 py-3 text-start whitespace-nowrap md:px-5">{client.code}</td>
                    <td className="px-3 py-3 text-start md:px-5">
                      <Link className="font-medium break-words text-primary" href={`/operations/clients/${client.id}`}>{client.name}</Link>
                    </td>
                    <td className="px-3 py-3 text-start break-words md:px-5">{client.companyName || "—"}</td>
                    <td className="px-3 py-3 text-start md:px-5"><StatusBadge value={client.status} /></td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><DateText value={client.updatedAt} /></td>
                    <td className="px-3 py-3 text-start md:px-5">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="sm" render={<Link href={`/operations/clients/${client.id}`} />}>{t("common.view")}</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(client); setOpen(true); }}>{t("common.edit")}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(client)}>{t("common.delete")}</Button>
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
      {open ? <ClientForm key={editing?.id ?? "new"} open client={editing} onClose={() => setOpen(false)} /> : null}
      {removing ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{t("clients.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.name}</p>
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
    <select className={`${controlClass} min-w-0 max-w-full`} name="status" defaultValue={value ?? "all"} aria-label={t("fields.status")}>
      <option value="all">{t("common.all")}</option>
      {(["active", "inactive", "potential", "archived"] as const).map((status) => (
        <option key={status} value={status}>{t(`status.${status}`)}</option>
      ))}
    </select>
  );
}
