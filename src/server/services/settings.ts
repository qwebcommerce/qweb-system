import "server-only";
import { collections } from "@/config/collections";
import { DEFAULT_COMPANY_NAME, DEFAULT_CURRENCY, DEFAULT_DATE_FORMAT } from "@/config/currency";
import { getAdminDb, isAdminFirebaseConfigured } from "@/lib/firebase/admin";
import { live } from "@/server/db";
import type { CompanySettings, DateFormat } from "@/types";

export const defaultCompanySettings: CompanySettings = {
  name: DEFAULT_COMPANY_NAME,
  logoUrl: null,
  email: "",
  phone: "",
  address: "",
  currency: DEFAULT_CURRENCY,
  info: "",
  defaultLanguage: "en",
  dateFormat: DEFAULT_DATE_FORMAT,
  updatedAt: null,
};

export async function getCompanySettings(): Promise<CompanySettings> {
  await live();
  if (!isAdminFirebaseConfigured()) return defaultCompanySettings;

  const snapshot = await getAdminDb().collection(collections.settings).doc("company").get();
  if (!snapshot.exists) return defaultCompanySettings;
  return mapCompany(snapshot.data() ?? {});
}

export async function getBootstrapState(): Promise<"unconfigured" | "open" | "done"> {
  await live();
  if (!isAdminFirebaseConfigured()) return "unconfigured";
  const snapshot = await getAdminDb().collection(collections.settings).doc("system").get();
  return snapshot.exists && snapshot.data()?.bootstrapped === true ? "done" : "open";
}

function mapCompany(data: FirebaseFirestore.DocumentData): CompanySettings {
  const language = data.defaultLanguage === "ar" ? "ar" : "en";
  const dateFormat = isDateFormat(data.dateFormat) ? data.dateFormat : DEFAULT_DATE_FORMAT;
  const updatedAt = data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : null;

  return {
    name: stringOr(data.name, DEFAULT_COMPANY_NAME),
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    email: stringOr(data.email, ""),
    phone: stringOr(data.phone, ""),
    address: stringOr(data.address, ""),
    currency: typeof data.currency === "string" && data.currency.length === 3 ? data.currency : DEFAULT_CURRENCY,
    info: stringOr(data.info, ""),
    defaultLanguage: language,
    dateFormat,
    updatedAt,
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function isDateFormat(value: unknown): value is DateFormat {
  return value === "dd/MM/yyyy" || value === "yyyy-MM-dd" || value === "MM/dd/yyyy";
}
