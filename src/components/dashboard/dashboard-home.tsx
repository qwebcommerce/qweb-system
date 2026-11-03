"use client";

import Link from "next/link";
import { pageLinksFor } from "@/components/layout/sidebar";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useI18n } from "@/components/providers/locale-provider";

export function DashboardHome() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const links = pageLinksFor(user.role).filter((link) => link.href !== "/dashboard");

  return (
    <div className="flex w-full flex-col gap-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.welcome", { name: user.displayName })}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("dashboard.intro")}</p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t("dashboard.modules")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  {link.phase > 1 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("common.phase", { phase: link.phase })}
                    </span>
                  ) : null}
                </div>
                <p className="font-medium">{t(link.labelKey)}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(link.descriptionKey)}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
