"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search } from "lucide-react";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { toast } from "sonner";
import { findPage, flattenLinks, visibleNavigation } from "@/config/navigation";
import { can } from "@/config/permissions";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { ThemeToggle } from "@/components/preferences/theme-toggle";
import { useI18n } from "@/components/providers/locale-provider";
import { useCurrentUser } from "@/components/providers/user-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getClientAuth } from "@/lib/firebase/client";
import { isPublicFirebaseConfigured } from "@/lib/firebase/public-config";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, direction } = useI18n();
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const page = findPage(pathname);
  const links = flattenLinks(visibleNavigation((permission) => can(user.role, permission))).filter(
    (link) => link.href !== "/dashboard",
  );
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return links.filter((link) => t(link.labelKey).toLowerCase().includes(term)).slice(0, 6);
  }, [links, query, t]);

  async function logout() {
    try {
      if (isPublicFirebaseConfigured()) {
        const { signOut } = await import("firebase/auth");
        await signOut(getClientAuth());
      }
    } catch {
      // The server session is cleared even if the browser client has no Firebase user.
    }
    await fetch("/api/auth/session", { method: "DELETE" });
    toast.success(t("common.logout"));
    router.push("/login");
    router.refresh();
  }

  const initials = user.displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const title = page.current ? t(page.current.labelKey) : t("nav.dashboard");

  return (
    <header className="sticky top-0 z-30 border-b border-black/8 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-black/85">
      <div className="h-0.5 bg-[#550000]" />
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full lg:hidden"
        aria-label={t("common.menu")}
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <Breadcrumb aria-label={t("nav.breadcrumb")}>
          <BreadcrumbList className="text-[11px] tracking-wide">
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">{t("nav.dashboard")}</BreadcrumbLink>
            </BreadcrumbItem>
            {page.current && page.current.href !== "/dashboard" ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-4 w-0.5 shrink-0 rounded-full bg-[#550000]" aria-hidden />
          <h1 className="truncate text-lg leading-none font-medium tracking-tight">{title}</h1>
        </div>
      </div>

      <div className="relative hidden w-full max-w-xs md:block">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#550000] dark:text-[#d4b4b4]" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("common.search")}
          className="h-10 rounded-full border-black/10 bg-[#f6f1f1] ps-9 shadow-none dark:border-white/10 dark:bg-white/6"
        />
        {query.trim() ? (
          <div className="absolute inset-x-0 top-12 z-40 rounded-2xl border bg-popover p-1 text-popover-foreground shadow-lg">
            <p className="px-2 py-1 text-xs text-muted-foreground">{t("search.pages")}</p>
            {results.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">{t("search.noResults")}</p>
            ) : (
              results.map((result) => (
                <Link
                  key={result.href}
                  href={result.href}
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => setQuery("")}
                >
                  {t(result.labelKey)}
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center rounded-full border border-black/10 bg-[#f7f4f4] p-0.5 sm:flex dark:border-white/10 dark:bg-white/5">
          <LanguageSwitcher variant="ghost" className="h-8 rounded-full px-2.5" />
          <ThemeToggle variant="ghost" className="rounded-full" />
          <NotificationMenu variant="ghost" className="rounded-full" />
        </div>
        <div className="sm:hidden">
          <NotificationMenu variant="ghost" className="rounded-full" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" className="h-10 gap-2 rounded-full px-1.5 pe-3 hover:bg-[#f6ecec] dark:hover:bg-white/8" />}
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-[#550000] text-xs font-medium text-white">{initials || "Q"}</AvatarFallback>
            </Avatar>
            <span className="hidden text-start md:block">
              <span className="block max-w-32 truncate text-sm leading-tight font-medium">{user.displayName}</span>
              <span className="block text-[11px] leading-tight text-[#550000] dark:text-[#d4b4b4]">{t(`roles.${user.role}`)}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <span className="block truncate">{user.displayName}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-1.5 py-1 text-xs text-muted-foreground">{t(`roles.${user.role}`)}</p>
            <DropdownMenuSeparator />
            <div className="px-1.5 py-1 sm:hidden">
              <LanguageSwitcher />
            </div>
            <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
              <LogOut />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={direction === "rtl" ? "right" : "left"} showCloseButton={false} className="w-72 gap-0 bg-[#0c0505] p-0 text-white">
          <SheetTitle className="sr-only">{t("common.menu")}</SheetTitle>
          <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      </div>
    </header>
  );
}
