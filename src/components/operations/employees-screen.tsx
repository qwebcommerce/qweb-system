"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveEmployeeAction } from "@/server/actions/operations";
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
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("employees.inactiveHint")}</p>
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form className="grid flex-1 gap-3 sm:grid-cols-[1fr_10rem_auto]" method="get">
            <Input name="q" defaultValue={query.q ?? ""} placeholder={t("common.search")} aria-label={t("common.search")} />
            <select className={controlClass} name="status" defaultValue={query.status ?? "all"} aria-label={t("fields.status")}>
              <option value="all">{t("common.all")}</option>
              {(["office", "remote", "inactive"] as const).map((status) => (
                <option key={status} value={status}>{t(`status.${status}`)}</option>
              ))}
            </select>
            <Button type="submit" variant="outline">{t("common.search")}</Button>
          </form>
          <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("employees.add")}</Button>
        </div>
      </Panel>
      {page.items.length === 0 ? <EmptyState>{t("employees.empty")}</EmptyState> : (
        <Panel>
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.code")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.name")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.position")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.salary")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.status")}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((employee) => (
                <tr key={employee.id} className="border-t border-border">
                  <td className="numeric px-2 py-3">{employee.code}</td>
                  <td className="px-2 py-3"><Link className="font-medium text-primary" href={`/operations/employees/${employee.id}`}>{employee.fullName}</Link></td>
                  <td className="px-2 py-3">{employee.position || "—"}</td>
                  <td className="px-2 py-3"><Money amount={employee.basicSalary} /></td>
                  <td className="px-2 py-3"><StatusBadge value={employee.workingStatus} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pager cursor={page.nextCursor} query={query} />
        </Panel>
      )}
      {open ? <EmployeeForm key={editing?.id ?? "new"} employee={editing} onClose={() => setOpen(false)} /> : null}
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
            <Input className="numeric h-10" type="date" {...form.register("startDate")} />
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
