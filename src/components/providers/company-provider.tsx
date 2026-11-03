"use client";

import { createContext, use, useSyncExternalStore } from "react";
import { DATE_FORMAT_STORAGE_KEY } from "@/config/session";
import type { CompanySettings, DateFormat } from "@/types";

const CompanyContext = createContext<CompanySettings | null>(null);
const DateFormatContext = createContext<{
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
} | null>(null);

export function CompanyProvider({
  company,
  children,
}: {
  company: CompanySettings;
  children: React.ReactNode;
}) {
  const dateFormat = useSyncExternalStore(
    subscribeDateFormat,
    () => readDateFormat(company.dateFormat),
    () => company.dateFormat,
  );

  function setDateFormat(format: DateFormat) {
    window.localStorage.setItem(DATE_FORMAT_STORAGE_KEY, format);
    window.dispatchEvent(new Event("qweb-date-format"));
  }

  return (
    <CompanyContext value={company}>
      <DateFormatContext value={{ dateFormat, setDateFormat }}>{children}</DateFormatContext>
    </CompanyContext>
  );
}

export function useCompany() {
  const company = use(CompanyContext);
  if (!company) throw new Error("useCompany must be used within CompanyProvider");
  return company;
}

export function useDateFormat() {
  const context = use(DateFormatContext);
  if (!context) throw new Error("useDateFormat must be used within CompanyProvider");
  return context;
}

function subscribeDateFormat(onStoreChange: () => void) {
  window.addEventListener("qweb-date-format", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("qweb-date-format", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readDateFormat(fallback: DateFormat): DateFormat {
  const stored = window.localStorage.getItem(DATE_FORMAT_STORAGE_KEY);
  if (stored === "dd/MM/yyyy" || stored === "yyyy-MM-dd" || stored === "MM/dd/yyyy") return stored;
  return fallback;
}
