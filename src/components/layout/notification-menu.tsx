"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { dismissInboxAction, inboxAction } from "@/server/actions/content";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
type InboxItem = {
  dedupeKey: string;
  type: "expense_overdue" | "task_overdue" | "project_delayed" | "payroll_pending";
  href: string;
  title: string;
};

export function NotificationMenu({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<InboxItem[] | null>(null);

  async function open(next: boolean) {
    if (!next) return;
    const result = await inboxAction();
    setItems(result.ok ? result.data ?? [] : []);
  }

  async function dismiss(item: InboxItem) {
    setItems((current) => current?.filter((entry) => entry.dedupeKey !== item.dedupeKey) ?? []);
    await dismissInboxAction(item);
  }

  return (
    <DropdownMenu onOpenChange={(next) => void open(next)}>
      <DropdownMenuTrigger render={<Button type="button" variant={variant} size="icon" className={className} aria-label={t("common.notifications")} />}>
        <Bell />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("common.notifications")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items === null ? <p className="px-2 py-3 text-sm text-muted-foreground">{t("common.loading")}</p> : null}
        {items && items.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">{t("common.noNotifications")}</p> : null}
        <ul>
          {items?.map((item) => (
            <li key={item.dedupeKey} className="flex items-start justify-between gap-2 px-2 py-2 text-sm">
              <Link href={item.href} className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t(`notifications.${item.type}`)}</span>
                <span className="line-clamp-2">{item.title}</span>
              </Link>
              <Button type="button" variant="ghost" size="sm" onClick={() => void dismiss(item)}>{t("notifications.dismiss")}</Button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
