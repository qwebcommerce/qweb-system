"use server";

import { z } from "zod";
import { collections } from "@/config/collections";
import { can } from "@/config/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/server/auth/session";
import { sanitizeActivityValue } from "@/server/services/activity";
import { stamp } from "@/server/db";
import { getCompanySettings } from "@/server/services/settings";

const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  info: z.string().trim().max(2000),
  defaultLanguage: z.enum(["en", "ar"]),
  dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"]),
});

export type SettingsResult = { ok: true } | { ok: false; error: "invalid" | "forbidden" | "failed" };

export async function updateCompanySettings(input: unknown): Promise<SettingsResult> {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) return { ok: false, error: "forbidden" };

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const previous = await getCompanySettings();
    const next = {
      ...parsed.data,
      currency: parsed.data.currency.toUpperCase(),
      logoUrl: previous.logoUrl,
      updatedAt: stamp(),
    };

    const db = getAdminDb();
    const batch = db.batch();
    batch.set(db.collection(collections.settings).doc("company"), next, { merge: true });
    batch.set(db.collection(collections.activityLogs).doc(), {
      userId: user.uid,
      userName: user.displayName,
      action: "settings.company.updated",
      module: "settings",
      recordId: "company",
      description: "Updated company settings.",
      previousValues: sanitizeActivityValue({ ...previous }),
      newValues: sanitizeActivityValue(parsed.data),
      createdAt: stamp(),
    });
    await batch.commit();
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}
