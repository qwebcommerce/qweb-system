"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={t("common.language")}
      onClick={() => setLocale(next)}
    >
      <Languages />
      {next === "ar" ? t("common.arabic") : t("common.english")}
    </Button>
  );
}
