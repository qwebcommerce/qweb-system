"use client";

import { useState } from "react";
import { createUserAction, deleteCategoryAction, saveCategoryAction, updateUserAction } from "@/server/actions/content";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateText, DialogActions, EditorDialog, EmptyState, Field, Panel, StatusBadge, controlClass, localizedName, useSavedRefresh } from "@/components/records/widgets";
import type { Category, Employee, Role, UserProfile } from "@/types";

type CategoryKind = "expense" | "revenue" | "project" | "article";

const kinds = ["expense", "revenue", "project", "article"] as const;

export function CategoriesScreen({ groups }: { groups: Record<CategoryKind, Category[]> }) {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const rows = groups[kind];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {kinds.map((item) => (
          <Button key={item} type="button" size="sm" variant={kind === item ? "default" : "outline"} onClick={() => setKind(item)}>{t(`categories.${item}`)}</Button>
        ))}
      </div>
      <div className="flex justify-end"><Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("categories.add")}</Button></div>
      {rows.length === 0 ? <EmptyState>{t("categories.empty")}</EmptyState> : (
        <Panel>
          <ul className="divide-y divide-border">
            {rows.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                <button type="button" className="text-start font-medium" onClick={() => { setEditing(category); setOpen(true); }}>{localizedName(category.name, locale)}</button>
                {category.systemKey ? <span className="text-xs text-muted-foreground">{t("categories.system")}</span> : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteCategoryAction(kind, category.id).then(() => window.location.reload())}>{t("common.delete")}</Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {open ? <CategoryForm key={`${kind}-${editing?.id ?? "new"}`} kind={kind} category={editing} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function CategoryForm({ kind, category, onClose }: { kind: CategoryKind; category: Category | null; onClose: () => void }) {
  const { t } = useI18n();
  const { error, finish } = useSavedRefresh();
  const [nameEn, setNameEn] = useState(category?.name.en ?? "");
  const [nameAr, setNameAr] = useState(category?.name.ar ?? "");
  const [active, setActive] = useState(category?.active ?? true);
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 100);
  const [pending, setPending] = useState(false);
  return (
    <EditorDialog open title={category ? t("categories.edit") : t("categories.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await saveCategoryAction({ kind, nameEn, nameAr, active, sortOrder }, category?.id);
        setPending(false);
        await finish(result, onClose);
      }}>
        <Field label={t("fields.englishName")}><Input className="h-10" value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></Field>
        <Field label={t("fields.arabicName")}><Input className="h-10" value={nameAr} onChange={(event) => setNameAr(event.target.value)} required /></Field>
        <Field label={t("fields.sortOrder")}><Input className="numeric h-10" type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{t("fields.active")}</label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={pending} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

export function UsersScreen({ users, employees }: { users: UserProfile[]; employees: Employee[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex justify-end"><Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>{t("users.add")}</Button></div>
      {users.length === 0 ? <EmptyState>{t("users.empty")}</EmptyState> : (
        <Panel>
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li key={user.uid} className="flex items-center justify-between gap-3 py-3">
                <button type="button" className="text-start" onClick={() => { setEditing(user); setOpen(true); }}>
                  <span className="block font-medium">{user.displayName}</span>
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                </button>
                <span className="text-sm">{t(`roles.${user.role}`)}</span>
                <StatusBadge value={user.active ? "active" : "inactive"} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {open ? <UserForm key={editing?.uid ?? "new"} user={editing} employees={employees} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function UserForm({ user, employees, onClose }: { user: UserProfile | null; employees: Employee[]; onClose: () => void }) {
  const { t } = useI18n();
  const current = useCurrentUser();
  const { error, finish } = useSavedRefresh();
  const [pending, setPending] = useState(false);
  return (
    <EditorDialog open title={user ? t("users.edit") : t("users.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        const shared = {
          displayName: String(form.get("displayName") ?? ""),
          role: String(form.get("role") ?? "staff") as Role,
          employeeId: String(form.get("employeeId") ?? "") || null,
        };
        const result = user
          ? await updateUserAction(user.uid, { ...shared, active: form.get("active") === "on", password: String(form.get("password") ?? "") })
          : await createUserAction({ ...shared, email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
        setPending(false);
        await finish(result, onClose);
      }}>
        <Field label={t("fields.name")}><Input className="h-10" name="displayName" defaultValue={user?.displayName ?? ""} required /></Field>
        {user ? null : <Field label={t("common.email")}><Input className="h-10" type="email" name="email" required /></Field>}
        <Field label={t("fields.password")}>
          <Input className="h-10" type="password" name="password" minLength={user ? undefined : 8} />
          {user ? <span className="text-xs text-muted-foreground">{t("users.passwordHint")}</span> : null}
        </Field>
        <Field label={t("fields.role")}>
          <select className={controlClass} name="role" defaultValue={user?.role ?? "staff"} disabled={user?.uid === current.uid}>
            {(["administrator", "manager", "staff"] as Role[]).map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
          </select>
        </Field>
        <Field label={t("users.linkedEmployee")}>
          <select className={controlClass} name="employeeId" defaultValue={user?.employeeId ?? ""}>
            <option value="">{t("common.none")}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
          </select>
        </Field>
        {user ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user.active} disabled={user.uid === current.uid} />{t("fields.active")}</label> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={pending} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

export function ActivityScreen({ rows }: { rows: Array<{ id: string; userName: string; action: string; module: string; description: string; createdAt: string }> }) {
  const { t } = useI18n();
  if (rows.length === 0) return <EmptyState>{t("activity.empty")}</EmptyState>;
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-start text-muted-foreground">
              <th className="px-2 py-2 font-medium">{t("activity.when")}</th>
              <th className="px-2 py-2 font-medium">{t("activity.who")}</th>
              <th className="px-2 py-2 font-medium">{t("activity.module")}</th>
              <th className="px-2 py-2 font-medium">{t("activity.action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-2 py-3"><DateText value={row.createdAt} /></td>
                <td className="px-2 py-3">{row.userName}</td>
                <td className="px-2 py-3">{row.module}</td>
                <td className="px-2 py-3">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
