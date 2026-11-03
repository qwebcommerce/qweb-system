"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveAccountAction, transferAction } from "@/server/actions/finance";
import { useCompany } from "@/components/providers/company-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, DateText, DialogActions, EditorDialog, EmptyState, Field, Money, Panel, controlClass, useSavedRefresh } from "@/components/records/widgets";
import type { AccountTransaction, CashAccount } from "@/types";

export function AccountsScreen({ accounts, transactions }: { accounts: CashAccount[]; transactions: AccountTransaction[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [editing, setEditing] = useState<CashAccount | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("accounts.transferHint")}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setTransfer(true)}>{t("accounts.transfer")}</Button>
        <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("accounts.add")}</Button>
      </div>
      {accounts.length === 0 ? <EmptyState>{t("accounts.empty")}</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <button key={account.id} type="button" className="rounded-xl bg-card p-4 text-start ring-1 ring-foreground/10" onClick={() => { setEditing(account); setOpen(true); }}>
              <p className="text-sm text-muted-foreground">{account.name}</p>
              <p className="mt-2 text-lg font-semibold"><Money amount={account.currentBalance} /></p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`status.${account.type}`)}{account.accountNumberLast4 ? ` · ${account.accountNumberLast4}` : ""}</p>
            </button>
          ))}
        </div>
      )}
      <Panel>
        <h2 className="mb-3 font-medium">{t("accounts.transactions")}</h2>
        {transactions.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
          <DataTable>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-t border-border">
                  <td className="px-2 py-2"><DateText value={txn.date} /></td>
                  <td className="px-2 py-2">{txn.description}</td>
                  <td className="px-2 py-2">{t(`status.${txn.direction === "in" ? "received" : "paid"}`)}</td>
                  <td className="px-2 py-2"><Money amount={txn.amount} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
      {open ? <AccountForm key={editing?.id ?? "new"} account={editing} onClose={() => setOpen(false)} /> : null}
      {transfer ? <TransferForm accounts={accounts} onClose={() => setTransfer(false)} /> : null}
    </div>
  );
}

function AccountForm({ account, onClose }: { account: CashAccount | null; onClose: () => void }) {
  const { t } = useI18n();
  const company = useCompany();
  const { error, finish } = useSavedRefresh();
  const form = useForm({
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? "cash",
      bankName: account?.bankName ?? "",
      accountNumberLast4: account?.accountNumberLast4 ?? "",
      openingBalance: account?.openingBalance ?? 0,
      currency: account?.currency ?? company.currency,
      notes: account?.notes ?? "",
    },
  });
  return (
    <EditorDialog open title={account ? t("accounts.edit") : t("accounts.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
        const result = await saveAccountAction({
          ...values,
          openingBalance: Number(values.openingBalance),
          bankName: values.bankName || null,
          accountNumberLast4: values.accountNumberLast4 || null,
        }, account?.id);
        await finish(result, onClose);
      })}>
        <Field label={t("fields.name")}><Input className="h-10" {...form.register("name", { required: true })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.type")}>
            <select className={controlClass} {...form.register("type")}><option value="cash">{t("status.cash")}</option><option value="bank">{t("status.bank")}</option></select>
          </Field>
          <Field label={t("fields.openingBalance")}><Input className="numeric h-10" type="number" min="0" step="0.01" {...form.register("openingBalance")} /></Field>
          <Field label={t("fields.bankName")}><Input className="h-10" {...form.register("bankName")} /></Field>
          <Field label={t("fields.last4")}><Input className="numeric h-10" maxLength={4} {...form.register("accountNumberLast4")} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">{t("accounts.last4Hint")}</p>
        <Field label={t("common.currency")}><Input className="numeric h-10 uppercase" maxLength={3} {...form.register("currency")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function TransferForm({ accounts, onClose }: { accounts: CashAccount[]; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  return (
    <EditorDialog open title={t("accounts.transfer")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{t("accounts.transferHint")}</p>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await transferAction({
          fromAccountId: form.get("fromAccountId"),
          toAccountId: form.get("toAccountId"),
          amount: form.get("amount"),
          date: form.get("date"),
          notes: form.get("notes") ?? "",
        });
        await finish(result, onClose);
      }}>
        <Field label={t("fields.fromAccount")}>
          <select className={controlClass} name="fromAccountId">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        </Field>
        <Field label={t("fields.toAccount")}>
          <select className={controlClass} name="toAccountId">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        </Field>
        <Field label={t("fields.amount")}><Input className="numeric h-10" type="number" name="amount" min="0.01" step="0.01" required /></Field>
        <Field label={t("fields.date")}><Input className="numeric h-10" type="date" name="date" required /></Field>
        <Field label={t("fields.notes")}><Input className="h-10" name="notes" /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={false} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
