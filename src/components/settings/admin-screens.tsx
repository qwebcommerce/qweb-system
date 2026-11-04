"use client";

import { useState } from "react";
import { createUserAction, deleteCategoryAction, deleteUserAction, saveCategoryAction, updateUserAction } from "@/server/actions/content";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
    <div className="flex w-full flex-col gap-4">
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
  const [pending, setPending] = useState(false);
  return (
    <EditorDialog open title={category ? t("categories.edit") : t("categories.add")} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await saveCategoryAction({ kind, nameEn, nameAr }, category?.id);
        setPending(false);
        await finish(result, onClose);
      }}>
        <Field label={t("fields.englishName")}><Input className="h-10" value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></Field>
        <Field label={t("fields.arabicName")}><Input className="h-10" value={nameAr} onChange={(event) => setNameAr(event.target.value)} required /></Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogActions pending={pending} onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

export function UsersScreen({ users, employees }: { users: UserProfile[]; employees: Employee[] }) {
  const { t } = useI18n();
  const current = useCurrentUser();
  const { error, finish } = useSavedRefresh();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [removing, setRemoving] = useState<UserProfile | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  function edit(user: UserProfile | null) {
    setEditing(user);
    setOpen(true);
  }

  async function remove() {
    if (!removing || removing.uid === current.uid) return;
    setPendingDelete(true);
    const result = await deleteUserAction(removing.uid);
    setPendingDelete(false);
    await finish(result, () => setRemoving(null));
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end"><Button type="button" onClick={() => edit(null)}>{t("users.add")}</Button></div>
      {users.length === 0 ? <EmptyState>{t("users.empty")}</EmptyState> : (
        <Panel className="overflow-hidden p-0 md:p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.name")}</th>
                  <th className="bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("common.email")}</th>
                  <th className="bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.role")}</th>
                  <th className="bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("fields.status")}</th>
                  <th className="bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid} className="border-t border-[#550000]/10">
                    <td className="px-5 py-3 text-start font-medium">{user.displayName}</td>
                    <td className="px-5 py-3 text-start">{user.email}</td>
                    <td className="px-5 py-3 text-start">{t(`roles.${user.role}`)}</td>
                    <td className="px-5 py-3 text-start"><StatusBadge value={user.active ? "active" : "inactive"} /></td>
                    <td className="px-5 py-3 text-start">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => edit(user)}>{t("common.edit")}</Button>
                        {user.uid === current.uid ? null : (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(user)}>{t("common.delete")}</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {!removing && error ? <p className="text-sm text-destructive">{error}</p> : null}
      {open ? <UserForm key={editing?.uid ?? "new"} user={editing} employees={employees} onClose={() => setOpen(false)} /> : null}
      {removing ? (
        <EditorDialog open title={t("common.delete")} onClose={() => { if (!pendingDelete) setRemoving(null); }}>
          <p className="text-sm leading-6">{t("users.deleteConfirm")}</p>
          <p className="text-sm font-medium">{removing.displayName}</p>
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
    <Panel className="overflow-hidden p-0 md:p-0">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[18%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("activity.when")}</th>
              <th className="w-[22%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("activity.who")}</th>
              <th className="w-[18%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("activity.module")}</th>
              <th className="w-[42%] bg-[#550000] px-5 py-3 text-start font-medium text-white">{t("activity.action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#550000]/10">
                <td className="px-5 py-3 text-start whitespace-nowrap"><DateText value={row.createdAt} /></td>
                <td className="px-5 py-3 text-start">{row.userName}</td>
                <td className="px-5 py-3 text-start">{row.module}</td>
                <td className="px-5 py-3 text-start">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
