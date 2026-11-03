"use client";

import { createContext, use, useCallback, useEffect, useSyncExternalStore } from "react";
import { LOCALE_STORAGE_KEY } from "@/config/session";
import { translate, type MessageKey } from "@/i18n";
import type { Locale } from "@/types";

interface LocaleContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("qweb-locale", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("qweb-locale", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(new Event("qweb-locale"));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => applyLocale(next), []);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return (
    <LocaleContext value={{ locale, direction: locale === "ar" ? "rtl" : "ltr", setLocale, t }}>
      {children}
    </LocaleContext>
  );
}

export function useI18n() {
  const context = use(LocaleContext);
  if (!context) throw new Error("useI18n must be used within LocaleProvider");
  return context;
}
