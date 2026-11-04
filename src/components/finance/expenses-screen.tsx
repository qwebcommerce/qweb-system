"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { downloadCsv, toCsv } from "@/lib/csv";
import { resolveNextDue } from "@/lib/financial/calculations";
import { deleteScheduleAction, exportExpensesAction, generateDueAction, removeExpenseAction, saveExpenseAction, saveScheduleAction, setScheduleActiveAction } from "@/server/actions/finance";
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
import type { CashAccount, Category, Expense, ExpenseStatus, PaymentMethod, RecurringExpense, ScheduleFrequency } from "@/types";

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
  const { error, finish } = useSavedRefresh();
  const [open, setOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringExpense | null>(null);
  const [removingSchedule, setRemovingSchedule] = useState<RecurringExpense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
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

  async function remove() {
    if (!removing || removing.sourceType === "payroll") return;
    setPendingDelete(true);
    const result = await removeExpenseAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  async function removeSchedule() {
    if (!removingSchedule) return;
    setPendingDelete(true);
    const result = await deleteScheduleAction(removingSchedule.id);
    setPendingDelete(false);
    await finish(result, () => setRemovingSchedule(null));
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
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("expenses.hint")}</p>
      <Panel className="p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <form className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center" method="get">
            <Input className="h-10 w-full sm:max-w-sm" name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={`${controlClass} sm:w-48`} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
            <Button type="submit" variant="outline" className="h-10 shrink-0 px-6">{t("common.search")}</Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => void generate()}>{t("expenses.generate")}</Button>
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => { setEditingSchedule(null); setScheduleOpen(true); }}>{t("expenses.schedule")}</Button>
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => void exportRows()}>{t("common.export")}</Button>
            <Button type="button" className="h-10 shrink-0 px-6" onClick={() => { setEditing(null); setOpen(true); }}>{t("expenses.add")}</Button>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("expenses.periodTotal")}: <Money amount={shown} /></p>
        {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("expenses.empty")}</EmptyState> : (
        <Panel className="overflow-hidden p-0 md:p-0">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[28%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.title")}</th>
                  <th className="w-[14%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.amount")}</th>
                  <th className="w-[16%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.dueDate")}</th>
                  <th className="w-[14%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.status")}</th>
                  <th className="w-[28%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((expense) => {
                  const payroll = expense.sourceType === "payroll";
                  return (
                    <tr key={expense.id} className="border-t border-[#550000]/10">
                      <td className="px-5 py-3 text-start">
                        <span className="font-medium">{expense.title}</span>
                        {expense.isRecurringOccurrence ? <span className="mt-1 block text-xs text-muted-foreground">{t("expenses.schedule")}</span> : null}
                      </td>
                      <td className="px-5 py-3 text-start"><Money amount={expense.amount} /></td>
                      <td className="px-5 py-3 text-start"><DateText value={expense.dueDate} /></td>
                      <td className="px-5 py-3 text-start"><StatusBadge value={expense.status} /></td>
                      <td className="px-5 py-3 text-start">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => setViewing(expense)}>{t("common.view")}</Button>
                          {payroll ? null : <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(expense); setOpen(true); }}>{t("common.edit")}</Button>}
                          {payroll ? null : (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(expense)}>
                              {expense.status === "paid" ? t("expenses.cancelPaid") : t("common.delete")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pager cursor={page.nextCursor} query={query} />
          </div>
        </Panel>
      )}
      <Panel>
        <h2 className="mb-3 font-medium">{t("expenses.schedules")}</h2>
        {schedules.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
          <ul className="space-y-2 text-sm">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>{schedule.title} · <Money amount={schedule.amount} /> · {t(`status.${schedule.frequency}`)}</span>
                <span className="text-muted-foreground">{t("fields.nextDue")} <DateText value={resolveNextDue(schedule)} /></span>
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingSchedule(schedule); setScheduleOpen(true); }}>{t("common.edit")}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRemovingSchedule(schedule)}>{t("common.delete")}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void setScheduleActiveAction(schedule.id, !schedule.active).then(() => window.location.reload())}>
                    {schedule.active ? t("status.active") : t("status.inactive")}
                  </Button>
                </div>
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
      {scheduleOpen ? (
        <ScheduleForm
          key={editingSchedule?.id ?? "new"}
          schedule={editingSchedule}
          categories={categories}
          clients={clients}
          projects={projects}
          onClose={() => setScheduleOpen(false)}
        />
      ) : null}
      {removingSchedule ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemovingSchedule(null); }}>
          <p className="text-sm leading-6">{t("expenses.deleteSchedule")}</p>
          <p className="text-sm font-medium">{removingSchedule.title}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pendingDelete} onClick={() => setRemovingSchedule(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={pendingDelete} onClick={() => void removeSchedule()}>{t("common.delete")}</Button>
          </DialogFooter>
        </EditorDialog>
      ) : null}
      {viewing ? (
        <ExpenseView
          expense={viewing}
          categories={categories}
          clients={clients}
          projects={projects}
          accounts={accounts}
          onClose={() => setViewing(null)}
        />
      ) : null}
      {removing ? (
        <EditorDialog open title={removing.status === "paid" ? t("expenses.cancelPaid") : t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{removing.status === "paid" ? t("expenses.cancelConfirm") : t("expenses.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.title}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pendingDelete} onClick={() => setRemoving(null)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={pendingDelete} onClick={() => void remove()}>
              {removing.status === "paid" ? t("expenses.cancelPaid") : t("common.delete")}
            </Button>
          </DialogFooter>
        </EditorDialog>
      ) : null}
    </div>
  );
}

function ExpenseView({
  expense,
  categories,
  clients,
  projects,
  accounts,
  onClose,
}: {
  expense: Expense;
  categories: Category[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string; clientId: string }>;
  accounts: CashAccount[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const category = categories.find((item) => item.id === expense.categoryId);
  return (
    <EditorDialog open title={expense.code || expense.title} onClose={onClose}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t("fields.title")}</dt>
          <dd className="mt-1">{expense.title}</dd>
        </div>
        <Detail label={t("fields.category")} value={category ? localizedName(category.name, locale) : ""} />
        <div>
          <dt className="text-muted-foreground">{t("fields.amount")}</dt>
          <dd className="mt-1"><Money amount={expense.amount} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.dueDate")}</dt>
          <dd className="mt-1"><DateText value={expense.dueDate} /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fields.status")}</dt>
          <dd className="mt-1"><StatusBadge value={expense.status} /></dd>
        </div>
        <Detail label={t("fields.client")} value={clients.find((item) => item.id === expense.clientId)?.name ?? ""} />
        <Detail label={t("fields.project")} value={projects.find((item) => item.id === expense.projectId)?.title ?? ""} />
        {expense.status === "paid" ? (
          <>
            <div>
              <dt className="text-muted-foreground">{t("fields.paidOn")}</dt>
              <dd className="mt-1"><DateText value={expense.paidAt} /></dd>
            </div>
            <Detail label={t("fields.method")} value={expense.paymentMethod ? t(`status.${expense.paymentMethod}`) : ""} />
            <Detail label={t("fields.account")} value={accounts.find((item) => item.id === expense.accountId)?.name ?? ""} />
          </>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">{t("fields.notes")}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{expense.notes || "—"}</dd>
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

function ScheduleForm({
  schedule,
  categories,
  clients,
  projects,
  onClose,
}: {
  schedule: RecurringExpense | null;
  categories: Category[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string }>;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm({
    defaultValues: schedule ? {
      categoryId: schedule.categoryId,
      title: schedule.title,
      amount: schedule.amount,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      endDate: schedule.endDate ?? "",
      clientId: schedule.clientId ?? "",
      projectId: schedule.projectId ?? "",
      defaultPaymentMethod: schedule.defaultPaymentMethod ?? "",
      notes: schedule.notes,
    } : { categoryId: categories[0]?.id ?? "", title: "", amount: 0, frequency: "monthly" as const, startDate: "", endDate: "", clientId: "", projectId: "", defaultPaymentMethod: "", notes: "" },
  });
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const frequency = form.watch("frequency") as ScheduleFrequency;
  const cadenceChanged = !schedule || startDate !== schedule.startDate || frequency !== schedule.frequency;
  const nextDue = resolveNextDue({
    startDate,
    endDate: endDate || null,
    frequency,
    anchorDay: cadenceChanged ? undefined : schedule?.anchorDay,
    nextDueDate: cadenceChanged ? null : schedule?.nextDueDate,
  });
  return (
    <EditorDialog open title={schedule ? t("expenses.editSchedule") : t("expenses.schedule")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
        const result = await saveScheduleAction({
          ...values,
          amount: Number(values.amount),
          endDate: values.endDate || null,
          clientId: values.clientId || null,
          projectId: values.projectId || null,
          defaultPaymentMethod: values.defaultPaymentMethod || null,
        }, schedule?.id);
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
        {startDate ? <p className="text-sm text-muted-foreground">{t("fields.nextDue")} <DateText value={nextDue} /></p> : null}
        <Field label={t("fields.notes")}><Input className="h-10" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

