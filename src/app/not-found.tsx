"use client";

import { useI18n } from "@/components/providers/locale-provider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-sm text-muted-foreground">{t("common.notFound")}</p>
    </div>
  );
}
