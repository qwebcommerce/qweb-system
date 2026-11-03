"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { AppToaster } from "@/components/providers/app-toaster";
import { THEME_STORAGE_KEY } from "@/config/session";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
    >
      <LocaleProvider>
        <TooltipProvider>
          {children}
          <AppToaster />
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
