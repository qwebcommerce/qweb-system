"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { SIDEBAR_STORAGE_KEY } from "@/config/session";
import { flattenLinks, pathIsActive, visibleNavigation, type NavLink } from "@/config/navigation";
import { can } from "@/config/permissions";
import { useI18n } from "@/components/providers/locale-provider";
import { useCurrentUser } from "@/components/providers/user-provider";
import { Wordmark } from "@/components/brand/wordmark";
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
        "flex h-full shrink-0 flex-col bg-[#0c0505] text-white",
        mobile ? "w-full" : compact ? "w-[4.75rem]" : "w-[17rem]",
        !mobile && "border-e border-[#550000]/35 transition-[width] duration-200",
      )}
    >
      <div className={cn("relative px-5 pt-5 pb-4", compact && "px-2 pt-4")}>
        <div className={cn("flex items-center gap-2", compact && "justify-center")}>
          <Wordmark variant="on-dark" markOnly={compact} className={compact ? "h-9" : "h-8"} />
          {mobile ? (
            <button
              type="button"
              className="ms-auto inline-flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              aria-label={t("common.close")}
              onClick={onNavigate}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-[#550000] to-transparent" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label={t("nav.breadcrumb")}>
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
            <div key={entry.id} className="pt-2">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-base text-white/55 hover:text-white",
                  compact && "justify-center px-0 tracking-normal",
                  active && "text-white/75",
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
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm text-white/55 hover:bg-white/8 hover:text-white",
              !compact && "justify-start px-2.5",
            )}
            aria-label={compact ? t("nav.expand") : t("nav.collapse")}
            onClick={toggleCollapsed}
          >
            {compact ? <PanelLeftOpen className="size-4 rtl:scale-x-[-1]" /> : <PanelLeftClose className="size-4 rtl:scale-x-[-1]" />}
            {!compact ? <span>{t("nav.collapse")}</span> : null}
          </button>
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
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-base transition-colors",
        nested && "ps-8 text-[15px]",
        compact && "justify-center px-0",
        active
          ? "bg-[#550000] font-medium text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/14%)]"
          : "text-white/68 hover:bg-white/7 hover:text-white",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-white/55")} />
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
