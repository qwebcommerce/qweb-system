import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { live } from "@/server/db";
import type { ActivityModule } from "@/types";

const sensitiveKeys = new Set([
  "password",
  "secret",
  "token",
  "idToken",
  "privateKey",
  "session",
  "authorization",
  "setupSecret",
]);

export function sanitizeActivityValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeActivityValue);
  if (!value || typeof value !== "object") return value;

  const clean: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKeys.has(key)) continue;
    clean[key] = sanitizeActivityValue(nested);
  }
  return clean;
}

export function activityRecord(input: {
  userId: string;
  userName: string;
  action: string;
  module: ActivityModule;
  recordId: string;
  description: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  return {
    userId: input.userId,
    userName: input.userName,
    action: input.action,
    module: input.module,
    recordId: input.recordId,
    description: input.description,
    previousValues: sanitizeActivityValue(input.previousValues ?? null),
    newValues: sanitizeActivityValue(input.newValues ?? null),
    createdAt: FieldValue.serverTimestamp(),
  };
}
export async function recordActivity(
  input: Parameters<typeof activityRecord>[0],
): Promise<void> {
  await live();
  await getAdminDb().collection(collections.activityLogs).add(activityRecord(input));
}
