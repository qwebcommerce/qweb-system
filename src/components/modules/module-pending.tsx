"use client";

import type { MessageKey } from "@/i18n";
import { useI18n } from "@/components/providers/locale-provider";

export function ModulePending({
  descriptionKey,
  phase,
}: {
  descriptionKey: MessageKey;
  phase: number;
}) {
  const { t } = useI18n();

  return (
    <section className="w-full rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-primary">{t("common.phase", { phase })}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(descriptionKey)}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("modules.pending", { phase })}</p>
    </section>
  );
}
