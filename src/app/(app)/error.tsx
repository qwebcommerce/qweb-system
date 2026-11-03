"use client";

import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-lg rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{t("common.error")}</p>
      <Button type="button" className="mt-4" onClick={() => reset()}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
