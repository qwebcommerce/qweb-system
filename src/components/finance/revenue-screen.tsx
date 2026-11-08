"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cancelRevenueAction, deleteRevenueAction, exportRevenueAction, saveRevenueAction } from "@/server/actions/finance";
import { downloadCsv, toCsv } from "@/lib/csv";
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
  Money,
  Pager,
  Panel,
  StatusBadge,
  controlClass,
  errorText,
  localizedName,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { CashAccount, Category, PaymentMethod, Revenue } from "@/types";

const schema = z.object({
  date: z.string().min(10),
  clientId: z.string().min(1),
  projectId: z.string(),
  categoryId: z.string().min(1),
  description: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["cash", "cheque", "card", "bank_transfer"]),
  notes: z.string(),
  accountId: z.string(),
  chequeNumber: z.string(),
  chequeBank: z.string(),
  chequeDate: z.string(),
});

export function RevenueScreen({
  page,
  query,
  categories,
  clients,
  projects,
  accounts,
}: {
  page: { items: Revenue[]; nextCursor: string | null };
  query: { q?: string; cursor?: string };
  categories: Category[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  accounts: CashAccount[];
}) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const [pending, setPending] = useState<{ item: Revenue; mode: "cancel" | "delete" } | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirmPending() {
    if (!pending) return;
    setPendingBusy(true);
    const result = pending.mode === "delete" ? await deleteRevenueAction(pending.item.id) : await cancelRevenueAction(pending.item.id);
    setPendingBusy(false);
    await finish(result, () => setPending(null));
  }

  async function exportRows() {
    const result = await exportRevenueAction();
    if (!result.ok || !result.data) {
      setMessage(errorText(t, result.ok ? "failed" : result.error));
      return;
    }
    downloadCsv("revenue.csv", toCsv(
      [t("fields.code"), t("fields.description"), t("fields.amount"), t("fields.date"), t("fields.status")],
      result.data.map((item) => [item.code, item.description, item.amount, item.date, item.status]),
    ));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("revenue.hint")}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => void exportRows()}>{t("common.export")}</Button>
        <Button type="button" className="h-10 w-full sm:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>{t("revenue.add")}</Button>
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {page.items.length === 0 ? <EmptyState>{t("revenue.empty")}</EmptyState> : (
        <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[28%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.description")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.date")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.amount")}</th>
                  <th className="w-[14%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.status")}</th>
                  <th className="w-[26%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
              {page.items.map((item) => (
                <tr key={item.id} className="border-t border-[#550000]/10">
                  <td className="px-3 py-3 text-start font-medium break-words md:px-5">{item.description}</td>
                  <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><DateText value={item.date} /></td>
                  <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={item.amount} /></td>
                  <td className="px-3 py-3 text-start md:px-5"><StatusBadge value={item.status} /></td>
                  <td className="px-3 py-3 text-start md:px-5">
                    <div className="flex flex-wrap items-center gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>{t("common.edit")}</Button>
                      {item.status === "received" ? <Button type="button" variant="ghost" size="sm" onClick={() => setPending({ item, mode: "cancel" })}>{t("revenue.cancel")}</Button> : null}
                      <Button type="button" variant="ghost" size="sm" onClick={() => setPending({ item, mode: "delete" })}>{t("common.delete")}</Button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 pb-4 md:px-5">
            <Pager cursor={page.nextCursor} query={query} />
          </div>
        </Panel>
      )}
      {open ? <RevenueForm key={editing?.id ?? "new"} revenue={editing} categories={categories} clients={clients} projects={projects} accounts={accounts} onClose={() => setOpen(false)} /> : null}
      {pending ? (
        <EditorDialog open title={pending.mode === "delete" ? t("common.delete") : t("revenue.cancel")} onClose={() => { if (!pendingBusy) setPending(null); }}>
          <p className="text-sm leading-6">{pending.mode === "delete" ? t("revenue.deleteConfirm") : t("revenue.cancelConfirm")}</p>
          <p className="text-sm font-medium">{pending.item.description}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pendingBusy} onClick={() => setPending(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={pendingBusy} onClick={() => void confirmPending()}>
              {pending.mode === "delete" ? t("common.delete") : t("revenue.cancel")}
            </Button>
          </DialogFooter>
        </EditorDialog>
      ) : null}
    </div>
  );
}

function RevenueForm({ revenue, categories, clients, projects, accounts, onClose }: { revenue: Revenue | null; categories: Category[]; clients: Array<{ id: string; name: string }>; projects: Array<{ id: string; title: string; clientId: string }>; accounts: CashAccount[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      date: revenue?.date ?? "",
      clientId: revenue?.clientId ?? clients[0]?.id ?? "",
      projectId: revenue?.projectId ?? "",
      categoryId: revenue?.categoryId ?? categories[0]?.id ?? "",
      description: revenue?.description ?? "",
      amount: revenue?.amount ?? 0,
      paymentMethod: revenue?.paymentMethod ?? "bank_transfer",
      notes: revenue?.notes ?? "",
      accountId: revenue?.accountId ?? "",
      chequeNumber: "",
      chequeBank: "",
      chequeDate: "",
    },
  });
  const [clientId, setClientId] = useState(revenue?.clientId ?? clients[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>(revenue?.paymentMethod ?? "bank_transfer");
  const clientField = form.register("clientId");
  const methodField = form.register("paymentMethod");
  return (
    <EditorDialog open title={revenue ? t("revenue.edit") : t("revenue.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
        const result = await saveRevenueAction({
          ...values,
          projectId: values.projectId || null,
          accountId: values.accountId || null,
          cheque: values.paymentMethod === "cheque" ? { number: values.chequeNumber, bankName: values.chequeBank, date: values.chequeDate || values.date, clearanceStatus: "pending" } : null,
        }, revenue?.id);
        await finish(result, onClose);
      })}>
        <Field label={t("fields.description")}><Input className="h-10" {...form.register("description")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.date")}><Input className="numeric h-10" type="date" {...form.register("date")} /></Field>
          <Field label={t("fields.amount")}><Input className="numeric h-10" type="number" min="0.01" step="0.01" {...form.register("amount")} /></Field>
          <Field label={t("fields.client")}>
            <select className={controlClass} {...clientField} onChange={(event) => { setClientId(event.target.value); void clientField.onChange(event); }}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          </Field>
          <Field label={t("fields.project")}>
            <select className={controlClass} {...form.register("projectId")}>
              <option value="">{t("common.none")}</option>
              {projects.filter((project) => project.clientId === clientId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </Field>
          <Field label={t("fields.category")}>
            <select className={controlClass} {...form.register("categoryId")}>{categories.map((category) => <option key={category.id} value={category.id}>{localizedName(category.name, locale)}</option>)}</select>
          </Field>
          <Field label={t("fields.method")}>
            <select className={controlClass} {...methodField} onChange={(event) => { setMethod(event.target.value as PaymentMethod); void methodField.onChange(event); }}>
              {(["cash", "cheque", "card", "bank_transfer"] as PaymentMethod[]).map((method) => <option key={method} value={method}>{t(`status.${method}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.account")}>
            <select className={controlClass} {...form.register("accountId")}><option value="">{t("common.none")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          </Field>
        </div>
        {method === "cheque" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("fields.chequeNumber")}><Input className="h-10" {...form.register("chequeNumber")} /></Field>
            <Field label={t("fields.chequeBank")}><Input className="h-10" {...form.register("chequeBank")} /></Field>
            <Field label={t("fields.date")}><Input className="numeric h-10" type="date" {...form.register("chequeDate")} /></Field>
          </div>
        ) : null}
        <Field label={t("fields.notes")}><Input className="h-10" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

