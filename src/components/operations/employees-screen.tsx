"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteEmployeeAction, saveEmployeeAction } from "@/server/actions/operations";
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
  requiredError,
  useSavedRefresh,
} from "@/components/records/widgets";
import type { Employee, EmployeeType, WorkingStatus } from "@/types";

const schema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim(),
  mobile: z.string().trim(),
  position: z.string().trim(),
  type: z.enum(["staff", "worker", "freelancer", "contractor"]),
  startDate: z.string().min(10),
  basicSalary: z.coerce.number().min(0),
  hourlyCost: z.coerce.number().min(0),
  workingStatus: z.enum(["office", "remote", "inactive"]),
  notes: z.string().trim(),
});

type Values = z.infer<typeof schema>;

export function EmployeesScreen({
  page,
  query,
}: {
  page: { items: Employee[]; nextCursor: string | null };
  query: { q?: string; status?: string; cursor?: string };
}) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Employee | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function remove() {
    if (!removing) return;
    setPendingDelete(true);
    const result = await deleteEmployeeAction(removing.id);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("employees.inactiveHint")}</p>
      <Panel className="p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
          <form className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_auto] lg:items-center" method="get">
            <Input className="h-10 w-full min-w-0 sm:col-span-2 lg:col-span-1" name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={`${controlClass} min-w-0 max-w-full`} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {(["office", "remote", "inactive"] as const).map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
            <Button type="submit" variant="outline" className="h-10 w-full px-6 sm:col-span-2 lg:col-span-1 lg:w-auto">{t("common.search")}</Button>
          </form>
          <Button type="button" className="h-10 w-full px-6 lg:w-auto" onClick={() => { setEditing(null); setOpen(true); }}>{t("employees.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("employees.empty")}</EmptyState> : (
        <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.code")}</th>
                  <th className="w-[20%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.name")}</th>
                  <th className="w-[16%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.position")}</th>
                  <th className="w-[14%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.salary")}</th>
                  <th className="w-[12%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("fields.status")}</th>
                  <th className="w-[26%] bg-[#550000] px-3 py-3 text-start font-medium text-white md:px-5">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((employee) => (
                  <tr key={employee.id} className="border-t border-[#550000]/10">
                    <td className="numeric px-3 py-3 text-start whitespace-nowrap md:px-5">{employee.code}</td>
                    <td className="px-3 py-3 text-start md:px-5"><Link className="font-medium break-words text-primary" href={`/operations/employees/${employee.id}`}>{employee.fullName}</Link></td>
                    <td className="px-3 py-3 text-start break-words md:px-5">{employee.position || "—"}</td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={employee.basicSalary} /></td>
                    <td className="px-3 py-3 text-start md:px-5"><StatusBadge value={employee.workingStatus} /></td>
                    <td className="px-3 py-3 text-start md:px-5">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button type="button" variant="outline" size="sm" render={<Link href={`/operations/employees/${employee.id}`} />}>{t("common.view")}</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(employee); setOpen(true); }}>{t("common.edit")}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(employee)}>{t("common.delete")}</Button>
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
      {open ? <EmployeeForm key={editing?.id ?? "new"} employee={editing} onClose={() => setOpen(false)} /> : null}
      {removing ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{t("employees.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.fullName}</p>
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

export function EmployeeForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: employee ? {
      fullName: employee.fullName,
      email: employee.email,
      mobile: employee.mobile,
      position: employee.position,
      type: employee.type,
      startDate: employee.startDate,
      basicSalary: employee.basicSalary,
      hourlyCost: employee.hourlyCost,
      workingStatus: employee.workingStatus,
      notes: employee.notes,
    } : {
      fullName: "", email: "", mobile: "", position: "", type: "staff", startDate: "", basicSalary: 0, hourlyCost: 0, workingStatus: "office", notes: "",
    },
  });

  async function onSubmit(values: Values) {
    const result = await saveEmployeeAction({ ...values, photoURL: employee?.photoURL ?? null }, employee?.id);
    await finish(result, onClose);
  }

  return (
    <EditorDialog open title={employee ? t("employees.edit") : t("employees.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label={t("fields.name")} error={requiredError(Boolean(form.formState.errors.fullName), t("validation.required"))}>
          <Input className="h-10" {...form.register("fullName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("common.email")}><Input className="h-10" {...form.register("email")} /></Field>
          <Field label={t("fields.mobile")}><Input className="numeric h-10" {...form.register("mobile")} /></Field>
          <Field label={t("fields.position")}><Input className="h-10" {...form.register("position")} /></Field>
          <Field label={t("fields.type")}>
            <select className={controlClass} {...form.register("type")}>
              {(["staff", "worker", "freelancer", "contractor"] as EmployeeType[]).map((type) => <option key={type} value={type}>{t(`status.${type}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.startDate")} error={requiredError(Boolean(form.formState.errors.startDate), t("validation.required"))}>
            <Input className="numeric h-10 w-full min-w-0 max-w-full" type="date" {...form.register("startDate")} />
          </Field>
          <Field label={t("fields.status")}>
            <select className={controlClass} {...form.register("workingStatus")}>
              {(["office", "remote", "inactive"] as WorkingStatus[]).map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
            </select>
          </Field>
          <Field label={t("fields.salary")}><Input className="numeric h-10" type="number" step="0.01" min="0" {...form.register("basicSalary")} /></Field>
          <Field label={t("fields.hourlyCost")}><Input className="numeric h-10" type="number" step="0.01" min="0" {...form.register("hourlyCost")} /></Field>
        </div>
        <Field label={t("fields.notes")}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register("notes")} /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={form.formState.isSubmitting} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
