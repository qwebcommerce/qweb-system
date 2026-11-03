"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/locale-provider";

export function LanguageSwitcher({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const { locale, setLocale, t } = useI18n();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      aria-label={t("common.language")}
      onClick={() => setLocale(next)}
    >
      <Languages />
      {next === "ar" ? t("common.arabic") : t("common.english")}
    </Button>
  );
}
