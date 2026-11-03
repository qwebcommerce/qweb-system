"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { downloadCsv, toCsv } from "@/lib/csv";
import { exportExpensesAction, generateDueAction, removeExpenseAction, saveExpenseAction, saveScheduleAction, setScheduleActiveAction } from "@/server/actions/finance";
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
  Money,
  Pager,
  Panel,
  StatusBadge,
  controlClass,
  errorText,
  localizedName,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { CashAccount, Category, Expense, ExpenseStatus, PaymentMethod, RecurringExpense } from "@/types";

const methods: PaymentMethod[] = ["cash", "cheque", "card", "bank_transfer"];
const statuses: ExpenseStatus[] = ["pending", "paid", "overdue", "cancelled"];

const schema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(1),
  amount: z.coerce.number().min(0),
  dueDate: z.string().min(10),
  expenseDate: z.string(),
  status: z.enum(["paid", "pending", "overdue", "cancelled"]),
  paymentMethod: z.string(),
  clientId: z.string(),
  projectId: z.string(),
  notes: z.string(),
  accountId: z.string(),
  paidOn: z.string(),
  chequeNumber: z.string(),
  chequeBank: z.string(),
  chequeDate: z.string(),
});

export function ExpensesScreen({
  page,
  query,
  categories,
  clients,
  projects,
  accounts,
  schedules,
}: {
  page: { items: Expense[]; nextCursor: string | null };
  query: { q?: string; status?: string; cursor?: string };
  categories: Category[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  accounts: CashAccount[];
  schedules: RecurringExpense[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shown = page.items.filter((item) => item.status === "paid").reduce((total, item) => total + item.amount, 0);

  async function generate() {
    const result = await generateDueAction();
    if (!result.ok) {
      setMessage(errorText(t, result.error));
      return;
    }
    toast.success(t("expenses.generated", { count: result.data ?? 0 }));
    window.location.reload();
  }

  async function exportRows() {
    const result = await exportExpensesAction(query.status);
    if (!result.ok || !result.data) {
      setMessage(errorText(t, result.ok ? "failed" : result.error));
      return;
    }
    downloadCsv("expenses.csv", toCsv(
      [t("fields.code"), t("fields.title"), t("fields.amount"), t("fields.dueDate"), t("fields.status")],
      result.data.map((item) => [item.code, item.title, item.amount, item.dueDate, item.status]),
    ));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("expenses.hint")}</p>
      <Panel>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <form className="grid flex-1 gap-3 sm:grid-cols-[1fr_10rem_auto]" method="get">
            <Input name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={controlClass} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
            <Button type="submit" variant="outline">{t("common.search")}</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void generate()}>{t("expenses.generate")}</Button>
            <Button type="button" variant="outline" onClick={() => setScheduleOpen(true)}>{t("expenses.schedule")}</Button>
            <Button type="button" variant="outline" onClick={() => void exportRows()}>{t("common.export")}</Button>
            <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("expenses.add")}</Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("expenses.periodTotal")}: <Money amount={shown} /></p>
        {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("expenses.empty")}</EmptyState> : (
        <Panel>
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.title")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.amount")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.dueDate")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.status")}</th>
                <th className="px-2 py-2 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((expense) => (
                <tr key={expense.id} className="border-t border-border">
                  <td className="px-2 py-3">
                    <button type="button" className="text-start font-medium text-primary" onClick={() => { setEditing(expense); setOpen(true); }}>{expense.title}</button>
                    {expense.isRecurringOccurrence ? <span className="mt-1 block text-xs text-muted-foreground">{t("expenses.schedule")}</span> : null}
                  </td>
                  <td className="px-2 py-3"><Money amount={expense.amount} /></td>
                  <td className="px-2 py-3"><DateText value={expense.dueDate} /></td>
                  <td className="px-2 py-3"><StatusBadge value={expense.status} /></td>
                  <td className="px-2 py-3">{expense.sourceType === "payroll" ? null : <RemoveExpense id={expense.id} paid={expense.status === "paid"} />}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pager cursor={page.nextCursor} query={query} />
        </Panel>
      )}
      <Panel>
        <h2 className="mb-3 font-medium">{t("expenses.schedules")}</h2>
        {schedules.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
          <ul className="space-y-2 text-sm">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>{schedule.title} · <Money amount={schedule.amount} /> · {t(`status.${schedule.frequency}`)}</span>
                <span className="text-muted-foreground">{t("fields.nextDue")} <DateText value={schedule.nextDueDate} /></span>
                <Button type="button" variant="outline" size="sm" onClick={() => void setScheduleActiveAction(schedule.id, !schedule.active).then(() => window.location.reload())}>
                  {schedule.active ? t("status.active") : t("status.inactive")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {open ? (
        <ExpenseForm
          key={editing?.id ?? "new"}
          expense={editing}
          categories={categories}
          clients={clients}
          projects={projects}
          accounts={accounts}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {scheduleOpen ? <ScheduleForm categories={categories} clients={clients} projects={projects} onClose={() => setScheduleOpen(false)} /> : null}
    </div>
  );
}

function ExpenseForm({
  expense,
  categories,
  clients,
  projects,
  accounts,
  onClose,
}: {
  expense: Expense | null;
  categories: Category[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  accounts: CashAccount[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const locked = expense?.sourceType === "payroll";
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      categoryId: expense?.categoryId ?? categories[0]?.id ?? "",
      title: expense?.title ?? "",
      amount: expense?.amount ?? 0,
      dueDate: expense?.dueDate ?? "",
      expenseDate: expense?.expenseDate ?? "",
      status: expense?.status ?? "pending",
      paymentMethod: expense?.paymentMethod ?? "",
      clientId: expense?.clientId ?? "",
      projectId: expense?.projectId ?? "",
      notes: expense?.notes ?? "",
      accountId: expense?.accountId ?? "",
      paidOn: expense?.paidAt ?? "",
      chequeNumber: "",
      chequeBank: "",
      chequeDate: "",
    },
  });
  const [status, setStatus] = useState<ExpenseStatus>(expense?.status ?? "pending");
  const [method, setMethod] = useState(expense?.paymentMethod ?? "");
  const [clientId, setClientId] = useState(expense?.clientId ?? "");
  const statusField = form.register("status");
  const methodField = form.register("paymentMethod");
  const clientField = form.register("clientId");

  async function onSubmit(values: z.infer<typeof schema>) {
    const result = await saveExpenseAction({
      ...values,
      expenseDate: values.expenseDate || null,
      paymentMethod: values.paymentMethod || null,
      clientId: values.clientId || null,
      projectId: values.projectId || null,
      accountId: values.status === "paid" ? values.accountId || null : null,
      paidOn: values.paidOn || null,
      cheque: values.paymentMethod === "cheque" ? {
        number: values.chequeNumber,
        bankName: values.chequeBank,
        date: values.chequeDate || values.dueDate,
        clearanceStatus: "pending",
      } : null,
    }, expense?.id);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={expense ? t("expenses.edit") : t("expenses.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field label={t("fields.title")}><Input className="h-10" disabled={locked} {...form.register("title")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.category")}>
            <select className={controlClass} disabled={locked} {...form.register("categoryId")}>
              {categories.map((category) => <option key={category.id} value={category.id}>{localizedName(category.name, locale)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.amount")}><Input className="numeric h-10" type="number" min="0" step="0.01" disabled={locked} {...form.register("amount")} /></Field>
          <Field label={t("fields.dueDate")}><Input className="numeric h-10" type="date" disabled={locked} {...form.register("dueDate")} /></Field>
          <Field label={t("fields.status")}>
            <select className={controlClass} disabled={locked} {...statusField} onChange={(event) => { setStatus(event.target.value as ExpenseStatus); void statusField.onChange(event); }}>
              {statuses.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.client")}>
            <select className={controlClass} disabled={locked} {...clientField} onChange={(event) => { setClientId(event.target.value); void clientField.onChange(event); }}>
              <option value="">{t("common.none")}</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </Field>
          <Field label={t("fields.project")}>
            <select className={controlClass} disabled={locked} {...form.register("projectId")}>
              <option value="">{t("common.none")}</option>
              {projects.filter((project) => !clientId || project.clientId === clientId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </Field>
        </div>
        {status === "paid" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.paidOn")}><Input className="numeric h-10" type="date" {...form.register("paidOn")} /></Field>
            <Field label={t("fields.method")}>
              <select className={controlClass} {...methodField} onChange={(event) => { setMethod(event.target.value); void methodField.onChange(event); }}>
                <option value="">{t("common.none")}</option>
                {methods.map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
              </select>
            </Field>
            <Field label={t("fields.account")}>
              <select className={controlClass} {...form.register("accountId")}>
                <option value="">{t("common.none")}</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </Field>
          </div>
        ) : null}
        {method === "cheque" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("fields.chequeNumber")}><Input className="numeric h-10" {...form.register("chequeNumber")} /></Field>
            <Field label={t("fields.chequeBank")}><Input className="h-10" {...form.register("chequeBank")} /></Field>
            <Field label={t("fields.date")}><Input className="numeric h-10" type="date" {...form.register("chequeDate")} /></Field>
          </div>
        ) : null}
        <Field label={t("fields.notes")}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {locked ? null : <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />}
      </form>
    </EditorDialog>
  );
}

function ScheduleForm({ categories, clients, projects, onClose }: { categories: Category[]; clients: Array<{ id: string; name: string }>; projects: Array<{ id: string; title: string }>; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm({
    defaultValues: { categoryId: categories[0]?.id ?? "", title: "", amount: 0, frequency: "monthly", startDate: "", endDate: "", clientId: "", projectId: "", defaultPaymentMethod: "", notes: "" },
  });
  return (
    <EditorDialog open title={t("expenses.schedule")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
        const result = await saveScheduleAction({
          ...values,
          amount: Number(values.amount),
          endDate: values.endDate || null,
          clientId: values.clientId || null,
          projectId: values.projectId || null,
          defaultPaymentMethod: values.defaultPaymentMethod || null,
        });
        await finish(result, onClose);
      })}>
        <Field label={t("fields.title")}><Input className="h-10" {...form.register("title", { required: true })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.category")}>
            <select className={controlClass} {...form.register("categoryId")}>{categories.map((category) => <option key={category.id} value={category.id}>{localizedName(category.name, locale)}</option>)}</select>
          </Field>
          <Field label={t("fields.amount")}><Input className="numeric h-10" type="number" min="0" step="0.01" {...form.register("amount")} /></Field>
          <Field label={t("fields.frequency")}>
            <select className={controlClass} {...form.register("frequency")}>
              <option value="monthly">{t("status.monthly")}</option>
              <option value="yearly">{t("status.yearly")}</option>
              <option value="daily">{t("status.daily")}</option>
            </select>
          </Field>
          <Field label={t("fields.startDate")}><Input className="numeric h-10" type="date" {...form.register("startDate", { required: true })} /></Field>
          <Field label={t("fields.endDate")}><Input className="numeric h-10" type="date" {...form.register("endDate")} /></Field>
          <Field label={t("fields.client")}>
            <select className={controlClass} {...form.register("clientId")}><option value="">{t("common.none")}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          </Field>
          <Field label={t("fields.project")}>
            <select className={controlClass} {...form.register("projectId")}><option value="">{t("common.none")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
          </Field>
        </div>
        <Field label={t("fields.notes")}><Input className="h-10" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function RemoveExpense({ id, paid }: { id: string; paid: boolean }) {
  const { t } = useI18n();
  const { finish } = useSavedRefresh();
  return <Button type="button" variant="ghost" size="sm" onClick={() => void finish(removeExpenseAction(id))}>{paid ? t("expenses.cancelPaid") : t("common.delete")}</Button>;
}
