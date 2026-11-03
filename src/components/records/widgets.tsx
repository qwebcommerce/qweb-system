"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/providers/company-provider";
import { useDateFormat } from "@/components/providers/company-provider";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDisplayDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/i18n";
import type { Locale } from "@/types";

export const controlClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
export const areaClass =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function Money({ amount }: { amount: number }) {
  const { locale } = useI18n();
  const company = useCompany();
  return <span className="numeric">{formatMoney(amount, company.currency, locale)}</span>;
}

export function DateText({ value }: { value: string | null | undefined }) {
  const { dateFormat } = useDateFormat();
  if (!value) return <>—</>;
  return <span className="numeric">{formatDisplayDate(value.slice(0, 10), dateFormat)}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  const { t } = useI18n();
  const key = `status.${value}` as MessageKey;
  const label = t(key);
  const tone =
    value === "paid" || value === "received" || value === "completed" || value === "active" || value === "published" || value === "cleared"
      ? "bg-success/15 text-success"
      : value === "overdue" || value === "cancelled" || value === "inactive" || value === "bounced"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/15 text-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label === key ? value : label}</span>;
}

export function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-card px-4 py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">{children}</p>;
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:p-5", className)}>{children}</section>;
}

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export function errorText(translate: (key: MessageKey, vars?: Record<string, string | number>) => string, error: string) {
  const key = `errors.${error}` as MessageKey;
  const message = translate(key);
  return message === key ? translate("errors.failed") : message;
}

export function useSavedRefresh() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function finish(result: { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>, close?: () => void) {
    const resolved = await result;
    if (!resolved.ok) {
      setError(errorText(t, resolved.error ?? "failed"));
      return false;
    }
    setError(null);
    toast.success(t("common.saved"));
    close?.();
    router.refresh();
    return true;
  }

  return { error, setError, finish };
}

export function EditorDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function DialogActions({
  pending,
  onCancel,
}: {
  pending: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <DialogFooter showCloseButton={false}>
      <Button type="button" variant="outline" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </DialogFooter>
  );
}

export function Pager({ cursor, query }: { cursor: string | null; query: Record<string, string | undefined> }) {
  const { t } = useI18n();
  if (!cursor) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && key !== "cursor") params.set(key, value);
  }
  params.set("cursor", cursor);
  return (
    <div className="mt-4 flex justify-end">
      <Button variant="outline" render={<Link href={`?${params.toString()}`} />}>
        {t("common.nextPage")}
      </Button>
    </div>
  );
}

export function localizedName(name: { en: string; ar: string }, locale: Locale) {
  return name[locale] || name.en;
}

export function requiredError(invalid: boolean, message: string) {
  return invalid ? message : null;
}
