"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SIDEBAR_STORAGE_KEY } from "@/config/session";
import { flattenLinks, pathIsActive, visibleNavigation, type NavLink } from "@/config/navigation";
import { can } from "@/config/permissions";
import { useCompany } from "@/components/providers/company-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { useCurrentUser } from "@/components/providers/user-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const user = useCurrentUser();
  const company = useCompany();
  const collapsed = useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const entries = visibleNavigation((permission) => can(user.role, permission));

  function toggleCollapsed() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event("qweb-sidebar"));
  }

  const compact = collapsed && !mobile;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground",
        mobile ? "w-full" : compact ? "w-[4.5rem]" : "w-64",
        !mobile && "transition-[width] duration-200",
      )}
    >
      <div className={cn("flex h-16 items-center gap-3 border-b border-sidebar-border px-4", compact && "justify-center px-2")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          Q
        </div>
        {!compact ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="truncate text-xs text-muted-foreground">{t("common.privateSystem")}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t("nav.breadcrumb")}>
        {entries.map((entry) => {
          if (entry.kind === "link") {
            return (
              <SidebarLink
                key={entry.href}
                item={entry}
                pathname={pathname}
                compact={compact}
                onNavigate={onNavigate}
              />
            );
          }

          const active = entry.children.some((child) => isActive(pathname, child.href));
          const expanded = openGroups[entry.id] ?? active ?? true;

          return (
            <div key={entry.id} className="space-y-1">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  compact && "justify-center",
                )}
                aria-expanded={compact ? undefined : expanded}
                title={compact ? t(entry.labelKey) : undefined}
                onClick={() => {
                  if (compact) {
                    toggleCollapsed();
                    setOpenGroups((current) => ({ ...current, [entry.id]: true }));
                    return;
                  }
                  setOpenGroups((current) => ({ ...current, [entry.id]: !expanded }));
                }}
              >
                <entry.icon className="size-4 shrink-0" />
                {!compact ? (
                  <>
                    <span className="flex-1 truncate text-start">{t(entry.labelKey)}</span>
                    <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </>
                ) : null}
              </button>
              {!compact && expanded
                ? entry.children.map((child) => (
                    <SidebarLink
                      key={child.href}
                      item={child}
                      pathname={pathname}
                      compact={false}
                      nested
                      onNavigate={onNavigate}
                    />
                  ))
                : null}
            </div>
          );
        })}
      </nav>

      {!mobile ? (
        <div className="border-t border-sidebar-border p-3">
          <Button
            type="button"
            variant="ghost"
            className={cn("w-full", compact && "px-0")}
            aria-label={compact ? t("nav.expand") : t("nav.collapse")}
            onClick={toggleCollapsed}
          >
            {compact ? <PanelLeftOpen className="rtl:scale-x-[-1]" /> : <PanelLeftClose className="rtl:scale-x-[-1]" />}
            {!compact ? <span>{t("nav.collapse")}</span> : null}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarLink({
  item,
  pathname,
  compact,
  nested = false,
  onNavigate,
}: {
  item: NavLink;
  pathname: string;
  compact: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={compact ? t(item.labelKey) : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
        nested && "ps-9",
        compact && "justify-center ps-2.5",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!compact ? <span className="truncate">{t(item.labelKey)}</span> : null}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathIsActive(pathname, href);
}

function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener("qweb-sidebar", onStoreChange);
  return () => window.removeEventListener("qweb-sidebar", onStoreChange);
}

function readCollapsed() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

export function pageLinksFor(role: Parameters<typeof can>[0]) {
  return flattenLinks(visibleNavigation((permission) => can(role, permission)));
}
