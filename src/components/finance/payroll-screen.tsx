"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generatePayrollAction, payPayrollAction, updatePayrollAction } from "@/server/actions/finance";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateText, DialogActions, EditorDialog, EmptyState, Field, Money, Panel, StatusBadge, controlClass, useSavedRefresh } from "@/components/records/widgets";
import type { CashAccount, LineAmount, PaymentMethod, Payroll } from "@/types";

export function PayrollScreen({ rows, month, accounts }: { rows: Payroll[]; month: string; accounts: CashAccount[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [editing, setEditing] = useState<Payroll | null>(null);
  const [paying, setPaying] = useState<Payroll | null>(null);
  const [viewing, setViewing] = useState<Payroll | null>(null);

  async function generate(formData: FormData) {
    const result = await generatePayrollAction(String(formData.get("month") ?? month));
    await finish(result);
    if (result.ok) router.push(`?month=${formData.get("month") ?? month}`);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("payroll.paidHint")}</p>
      <Panel className="p-5 md:p-6">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); void generate(new FormData(event.currentTarget)); }}>
          <div className="w-full sm:w-48">
            <Field label={t("fields.month")}><Input className="numeric h-10 w-full" type="month" name="month" defaultValue={month} /></Field>
          </div>
          <Button type="submit" className="h-10 shrink-0 px-6">{t("payroll.generate")}</Button>
        </form>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </Panel>
      {rows.length === 0 ? <EmptyState>{t("payroll.empty")}</EmptyState> : (
        <Panel className="overflow-hidden p-0 md:p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[22%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.employee")}</th>
                  <th className="w-[16%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.totalPayable")}</th>
                  <th className="w-[14%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.status")}</th>
                  <th className="w-[16%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.paidOn")}</th>
                  <th className="w-[32%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#550000]/10">
                    <td className="px-5 py-3 text-start font-medium">{row.employeeName}</td>
                    <td className="px-5 py-3 text-start"><Money amount={row.totalPayable} /></td>
                    <td className="px-5 py-3 text-start"><StatusBadge value={row.status} /></td>
                    <td className="px-5 py-3 text-start"><DateText value={row.paymentDate} /></td>
                    <td className="px-5 py-3 text-start">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setViewing(row)}>{t("common.view")}</Button>
                        {row.status !== "paid" ? <Button type="button" size="sm" variant="outline" onClick={() => setEditing(row)}>{t("common.edit")}</Button> : null}
                        {row.status !== "paid" ? <Button type="button" size="sm" onClick={() => setPaying(row)}>{t("payroll.pay")}</Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {viewing ? <PayrollView payroll={viewing} accounts={accounts} onClose={() => setViewing(null)} /> : null}
      {editing ? <PayrollEditor key={editing.id} payroll={editing} onClose={() => setEditing(null)} /> : null}
      {paying ? <PayDialog key={paying.id} payroll={paying} accounts={accounts} onClose={() => setPaying(null)} /> : null}
    </div>
  );
}

function PayrollView({ payroll, accounts, onClose }: { payroll: Payroll; accounts: CashAccount[]; onClose: () => void }) {
  const { t } = useI18n();
  const account = accounts.find((item) => item.id === payroll.accountId);
  return (
    <EditorDialog open title={payroll.code || payroll.employeeName} onClose={onClose}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label={t("fields.code")} value={payroll.code} />
        <Detail label={t("fields.employee")} value={payroll.employeeName} />
        <Detail label={t("fields.month")} value={payroll.month} />
        <div>
          <dt className="text-muted-foreground">{t("fields.status")}</dt>
          <dd className="mt-1"><StatusBadge value={payroll.status} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.salary")}</dt>
          <dd className="mt-1"><Money amount={payroll.basicSalary} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.totalPayable")}</dt>
          <dd className="mt-1"><Money amount={payroll.totalPayable} /></dd>
        </div>
        <Lines label={t("fields.bonuses")} lines={payroll.bonuses} />
        <Lines label={t("fields.deductions")} lines={payroll.deductions} />
        <Lines label={t("fields.adjustments")} lines={payroll.adjustments} />
        <div>
          <dt className="text-muted-foreground">{t("fields.paidOn")}</dt>
          <dd className="mt-1"><DateText value={payroll.paymentDate} /></dd>
        </div>
        <Detail label={t("fields.method")} value={payroll.paymentMethod ? t(`status.${payroll.paymentMethod}`) : ""} />
        <Detail label={t("fields.account")} value={account?.name ?? ""} />
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t("fields.notes")}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{payroll.notes || "—"}</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{t("common.close")}</Button>
      </div>
    </EditorDialog>
  );
}

function Lines({ label, lines }: { label: string; lines: LineAmount[] }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        {lines.length === 0 ? "—" : (
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-4">
                <span>{line.title || "—"}{line.notes ? <span className="text-muted-foreground"> · {line.notes}</span> : null}</span>
                <Money amount={line.amount} />
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
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

function PayrollEditor({ payroll, onClose }: { payroll: Payroll; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [bonuses, setBonuses] = useState<LineAmount[]>(payroll.bonuses);
  const [deductions, setDeductions] = useState<LineAmount[]>(payroll.deductions);
  const [adjustments, setAdjustments] = useState<LineAmount[]>(payroll.adjustments);
  const [notes, setNotes] = useState(payroll.notes);
  const [pending, setPending] = useState(false);

  function add(setter: React.Dispatch<React.SetStateAction<LineAmount[]>>) {
    setter((lines) => [...lines, { id: crypto.randomUUID(), title: "", amount: 0, notes: "" }]);
  }

  async function save() {
    setPending(true);
    const result = await updatePayrollAction(payroll.id, { bonuses, deductions, adjustments, notes });
    setPending(false);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={t("payroll.edit")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{payroll.employeeName} · <Money amount={payroll.basicSalary} /></p>
      <LineEditor label={t("fields.bonuses")} lines={bonuses} onChange={setBonuses} onAdd={() => add(setBonuses)} />
      <LineEditor label={t("fields.deductions")} lines={deductions} onChange={setDeductions} onAdd={() => add(setDeductions)} />
      <LineEditor label={t("fields.adjustments")} lines={adjustments} onChange={setAdjustments} onAdd={() => add(setAdjustments)} />
      <Field label={t("fields.notes")}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="button" disabled={pending} onClick={() => void save()}>{pending ? t("common.saving") : t("common.save")}</Button>
      </div>
    </EditorDialog>
  );
}

function LineEditor({ label, lines, onChange, onAdd }: { label: string; lines: LineAmount[]; onChange: (lines: LineAmount[]) => void; onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><span className="text-sm font-medium">{label}</span><Button type="button" size="sm" variant="outline" onClick={onAdd}>{t("common.add")}</Button></div>
      {lines.map((line) => (
        <div key={line.id} className="grid grid-cols-[1fr_8rem] gap-2">
          <Input value={line.title} placeholder={t("payroll.lineTitle")} onChange={(event) => onChange(lines.map((item) => item.id === line.id ? { ...item, title: event.target.value } : item))} />
          <Input className="numeric" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => onChange(lines.map((item) => item.id === line.id ? { ...item, amount: Number(event.target.value) } : item))} />
        </div>
      ))}
    </div>
  );
}

function PayDialog({ payroll, accounts, onClose }: { payroll: Payroll; accounts: CashAccount[]; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  return (
    <EditorDialog open title={t("payroll.pay")} onClose={onClose}>
      <p className="text-sm">{payroll.employeeName} · <Money amount={payroll.totalPayable} /></p>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await payPayrollAction(payroll.id, {
          paymentDate: form.get("paymentDate"),
          paymentMethod: form.get("paymentMethod"),
          accountId: form.get("accountId") || null,
          notes: form.get("notes") ?? "",
        });
        await finish(result, onClose);
      }}>
        <Field label={t("fields.date")}><Input className="numeric h-10" type="date" name="paymentDate" required /></Field>
        <Field label={t("fields.method")}>
          <select className={controlClass} name="paymentMethod" defaultValue="bank_transfer">
            {(["cash", "cheque", "card", "bank_transfer"] as PaymentMethod[]).map((method) => <option key={method} value={method}>{t(`status.${method}`)}</option>)}
          </select>
        </Field>
        <Field label={t("fields.account")}>
          <select className={controlClass} name="accountId"><option value="">{t("common.none")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        </Field>
        <Field label={t("fields.notes")}><Input className="h-10" name="notes" /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={false} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
