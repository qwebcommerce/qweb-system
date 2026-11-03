"use client";

import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/components/providers/locale-provider";

export function AppToaster() {
  const { direction } = useI18n();
  return <Toaster dir={direction} position="top-center" closeButton />;
}
