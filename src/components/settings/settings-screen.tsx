"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { can } from "@/config/permissions";
import { updateCompanySettings } from "@/server/actions/settings";
import { useCompany, useDateFormat } from "@/components/providers/company-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { useCurrentUser } from "@/components/providers/user-provider";
import { ThemeToggle } from "@/components/preferences/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySettings, DateFormat, Locale } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  info: z.string().trim().max(2000),
  defaultLanguage: z.enum(["en", "ar"]),
  dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"]),
});

type CompanyValues = z.infer<typeof schema>;

export function SettingsScreen({ company }: { company: CompanySettings }) {
  const { t, locale, setLocale } = useI18n();
  const user = useCurrentUser();
  const currentCompany = useCompany();
  const { dateFormat, setDateFormat } = useDateFormat();
  const isAdmin = can(user.role, "settings.manage");
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CompanyValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      currency: company.currency,
      info: company.info,
      defaultLanguage: company.defaultLanguage,
      dateFormat: company.dateFormat,
    },
  });

  async function onSubmit(values: CompanyValues) {
    setFormError(null);
    const result = await updateCompanySettings({
      ...values,
      currency: values.currency.toUpperCase(),
    });
    if (!result.ok) {
      setFormError(result.error === "forbidden" ? t("settings.forbidden") : t("settings.saveFailed"));
      return;
    }
    toast.success(t("settings.saved"));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <section className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="text-base font-semibold">{t("settings.preferences")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.languageHint")}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="user-language">{t("settings.yourLanguage")}</Label>
            <select
              id="user-language"
              className="h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="en">{t("common.english")}</option>
              <option value="ar">{t("common.arabic")}</option>
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="user-date">{t("settings.yourDateFormat")}</Label>
            <select
              id="user-date"
              className="numeric h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value as DateFormat)}
            >
              <option value="dd/MM/yyyy">dd/MM/yyyy</option>
              <option value="yyyy-MM-dd">yyyy-MM-dd</option>
              <option value="MM/dd/yyyy">MM/dd/yyyy</option>
            </select>
          </div>
          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
            <Label>{t("settings.yourTheme")}</Label>
            <div className="flex min-h-10 min-w-0 items-center gap-2">
              <ThemeToggle />
              <span className="min-w-0 text-sm break-words text-muted-foreground">{t("settings.themeHint")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t("settings.company")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("settings.companyHint")}</p>
          </div>
          {!isAdmin ? <span className="shrink-0 text-xs text-muted-foreground">{t("settings.adminOnly")}</span> : null}
        </div>

        {isAdmin ? (
          <form className="mt-5 grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FormField label={t("settings.company")} error={form.formState.errors.name ? t("validation.companyName") : null}>
              <Input className="h-10" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("common.email")} error={form.formState.errors.email ? t("validation.email") : null}>
                <Input type="email" className="h-10" {...form.register("email")} />
              </FormField>
              <FormField label={t("common.phone")}>
                <Input className="numeric h-10" {...form.register("phone")} />
              </FormField>
            </div>
            <FormField label={t("common.address")}>
              <Input className="h-10" {...form.register("address")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label={t("common.currency")} error={form.formState.errors.currency ? t("validation.currency") : null}>
                <Input className="numeric h-10 uppercase" maxLength={3} {...form.register("currency")} />
              </FormField>
              <FormField label={t("settings.defaultLanguage")}>
                <select className="h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...form.register("defaultLanguage")}>
                  <option value="en">{t("common.english")}</option>
                  <option value="ar">{t("common.arabic")}</option>
                </select>
              </FormField>
              <FormField label={t("settings.dateFormat")}>
                <select className="numeric h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...form.register("dateFormat")}>
                  <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                  <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                  <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                </select>
              </FormField>
            </div>
            <FormField label={t("settings.about")}>
              <textarea
                className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...form.register("info")}
              />
            </FormField>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <div>
              <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="mt-5 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
            <Info label={t("settings.company")} value={currentCompany.name} />
            <Info label={t("common.currency")} value={currentCompany.currency} numeric />
            <Info label={t("common.email")} value={currentCompany.email || "—"} />
            <Info label={t("common.phone")} value={currentCompany.phone || "—"} numeric />
          </dl>
        )}
      </section>

    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-0 space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function Info({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={numeric ? "numeric mt-1 font-medium break-words" : "mt-1 font-medium break-words"}>{value}</dd>
    </div>
  );
}
