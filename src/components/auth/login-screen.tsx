"use client";

import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { ThemeToggle } from "@/components/preferences/theme-toggle";
import { useI18n } from "@/components/providers/locale-provider";

export function LoginScreen() {
  const { t } = useI18n();

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="order-2 flex flex-col bg-background px-6 py-6 text-foreground sm:px-10 lg:order-1 lg:min-h-dvh">
        <div className="flex items-center justify-between gap-4">
          <Wordmark className="h-10" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className="text-4xl tracking-tight">{t("auth.signIn")}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t("auth.signInSubtitle")}</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
      <aside className="order-1 flex flex-col justify-between bg-[#550000] px-8 py-10 text-white lg:order-2 lg:min-h-dvh lg:px-14 lg:py-12">
        <p className="text-sm tracking-[0.28em] text-white/70">QWEB</p>
        <div className="py-10">
          <Wordmark variant="on-maroon" className="h-16 sm:h-20" />
          <p className="mt-8 max-w-md text-2xl leading-snug text-white">{t("auth.brandLine")}</p>
          <p className="mt-4 max-w-md text-base leading-7 text-white/80">{t("auth.brandNote")}</p>
        </div>
        <p className="text-sm text-white/80">{t("common.privateSystem")}</p>
      </aside>
    </div>
  );
}
