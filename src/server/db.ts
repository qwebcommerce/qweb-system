import "server-only";
import { connection } from "next/server";
import type { DocumentData, Query, Transaction } from "firebase-admin/firestore";
import { collections } from "@/config/collections";
import { adminFieldValue, getAdminDb, readyFirebase } from "@/lib/firebase/admin";

/**
 * Marks the current render as request-time work.
 * Firebase Admin draws random bytes, which Next.js refuses during prerender.
 */
export async function live() {
  await connection();
  await readyFirebase();
}

export function database() {
  return getAdminDb();
}

export function stamp() {
  return adminFieldValue().serverTimestamp();
}

export function asIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

export function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNullable(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function allocateCode(tx: Transaction, name: string, prefix: string) {
  const ref = database().collection(collections.counters).doc(name);
  const snapshot = await tx.get(ref);
  const value = asNumber(snapshot.data()?.value) + 1;
  return { ref, value, code: `${prefix}-${String(value).padStart(5, "0")}` };
}

export async function collectDocuments<T>(
  query: Query,
  map: (id: string, data: DocumentData) => T,
  cap = 2000,
): Promise<T[]> {
  const items: T[] = [];
  let page = query.limit(300);
  while (items.length < cap) {
    const snapshot = await page.get();
    for (const doc of snapshot.docs) items.push(map(doc.id, doc.data()));
    if (snapshot.size < 300 || items.length >= cap) break;
    const last = snapshot.docs.at(-1);
    if (!last) break;
    page = query.startAfter(last).limit(300);
  }
  return items.slice(0, cap);
}

export type Page<T> = { items: T[]; nextCursor: string | null };

export const PAGE_SIZE = 25;
