"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { permissions, type Permission, type RoleGrants } from "@/config/permissions";
import { updateRolePermissions } from "@/server/actions/settings";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/i18n";

const labels: Record<Permission, MessageKey> = {
  "dashboard.view": "permissions.dashboard",
  "finance.view": "permissions.finance",
  "operations.view": "permissions.operations",
  "tasks.view": "permissions.tasks",
  "articles.view": "permissions.articles",
  "settings.view": "permissions.settingsView",
  "settings.manage": "permissions.settingsManage",
};

export function PermissionsScreen({ grants }: { grants: RoleGrants }) {
  const { t } = useI18n();
  const router = useRouter();
  const [manager, setManager] = useState(grants.manager);
  const [staff, setStaff] = useState(grants.staff);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(role: "manager" | "staff", permission: Permission) {
    const update = role === "manager" ? setManager : setStaff;
    update((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await updateRolePermissions({ manager, staff });
    setPending(false);
    if (!result.ok) {
      setError(result.error === "forbidden" ? t("permissions.forbidden") : t("permissions.saveFailed"));
      return;
    }
    toast.success(t("permissions.saved"));
    router.refresh();
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("permissions.hint")}</p>
      <section className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <ul className="divide-y divide-[#550000]/10">
          {permissions.map((permission) => (
            <li key={permission} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem] sm:items-center">
              <span className="text-sm font-medium break-words">{t(labels[permission])}</span>
              <Choice label={t("roles.administrator")} checked disabled onChange={() => undefined} />
              <Choice label={t("roles.manager")} checked={manager.includes(permission)} onChange={() => toggle("manager", permission)} />
              <Choice label={t("roles.staff")} checked={staff.includes(permission)} onChange={() => toggle("staff", permission)} />
            </li>
          ))}
        </ul>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <Button type="button" className="mt-4 h-10 w-full sm:w-auto" disabled={pending} onClick={() => void save()}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </section>
    </div>
  );
}

function Choice({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-[#550000]" checked={checked} disabled={disabled} onChange={onChange} />
      <span className={disabled ? "text-muted-foreground" : undefined}>{label}</span>
    </label>
  );
}
