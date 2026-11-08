"use server";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { collections } from "@/config/collections";
import { DEFAULT_CURRENCY, DEFAULT_DATE_FORMAT } from "@/config/currency";
import {
  articleCategorySeeds,
  expenseCategorySeeds,
  projectTypeSeeds,
  revenueCategorySeeds,
  type SeedCategory,
} from "@/config/seed";
import { getAdminAuth, getAdminDb, isAdminFirebaseConfigured, readyFirebase } from "@/lib/firebase/admin";
import { stamp } from "@/server/db";
import { sanitizeActivityValue } from "@/server/services/activity";

const setupSchema = z.object({
  secret: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export type SetupError =
  | "unconfigured"
  | "bootstrapped"
  | "invalid"
  | "secret"
  | "exists"
  | "auth_disabled"
  | "failed";

export type SetupResult = { ok: true } | { ok: false; error: SetupError };

export async function createFirstAdministrator(input: {
  secret: string;
  name: string;
  email: string;
  password: string;
}): Promise<SetupResult> {
  if (!isAdminFirebaseConfigured() || !process.env.SETUP_SECRET) {
    return { ok: false, error: "unconfigured" };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!safeEqual(parsed.data.secret, process.env.SETUP_SECRET)) {
    return { ok: false, error: "secret" };
  }

  await readyFirebase();
  const auth = getAdminAuth();
  const db = getAdminDb();
  const systemRef = db.collection(collections.settings).doc("system");
  const existingSystem = await systemRef.get();
  if (existingSystem.exists && existingSystem.data()?.bootstrapped === true) {
    return { ok: false, error: "bootstrapped" };
  }

  const email = parsed.data.email.toLowerCase();
  let createdUid: string | null = null;

  try {
    const user = await findOrCreateAdministrator(auth, {
      email,
      password: parsed.data.password,
      displayName: parsed.data.name,
    });
    createdUid = user.created ? user.uid : null;

    await auth.setCustomUserClaims(user.uid, {
      role: "administrator",
      active: true,
    });

    await db.runTransaction(async (transaction) => {
      const system = await transaction.get(systemRef);
      if (system.exists && system.data()?.bootstrapped === true) {
        throw new Error("bootstrapped");
      }

      const now = stamp();
      transaction.set(systemRef, {
        bootstrapped: true,
        bootstrappedAt: now,
      });
      transaction.set(db.collection(collections.users).doc(user.uid), {
        uid: user.uid,
        email,
        displayName: parsed.data.name,
        role: "administrator",
        active: true,
        employeeId: null,
        photoURL: null,
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      });
      transaction.set(db.collection(collections.settings).doc("company"), {
        name: "Qweb",
        logoUrl: null,
        email: "",
        phone: "",
        address: "",
        currency: DEFAULT_CURRENCY,
        info: "",
        defaultLanguage: "en",
        dateFormat: DEFAULT_DATE_FORMAT,
        updatedAt: now,
      });
      writeCategories(transaction, db, collections.expenseCategories, expenseCategorySeeds, user.uid);
      writeCategories(transaction, db, collections.revenueCategories, revenueCategorySeeds, user.uid);
      writeCategories(transaction, db, collections.projectTypes, projectTypeSeeds, user.uid);
      writeCategories(transaction, db, collections.articleCategories, articleCategorySeeds, user.uid);
      transaction.set(db.collection(collections.activityLogs).doc(), {
        userId: user.uid,
        userName: parsed.data.name,
        action: "user.bootstrapped",
        module: "users",
        recordId: user.uid,
        description: "Created the first administrator.",
        previousValues: null,
        newValues: sanitizeActivityValue({
          email,
          displayName: parsed.data.name,
          role: "administrator",
        }),
        createdAt: now,
      });
    });

    return { ok: true };
  } catch (error) {
    if (createdUid) {
      await auth.deleteUser(createdUid).catch(() => undefined);
    }
    if (error instanceof Error && error.message === "bootstrapped") {
      return { ok: false, error: "bootstrapped" };
    }
    const code = authCode(error);
    if (code.includes("email-already-exists")) return { ok: false, error: "exists" };
    if (code.includes("configuration-not-found")) return { ok: false, error: "auth_disabled" };
    return { ok: false, error: "failed" };
  }
}

async function findOrCreateAdministrator(
  auth: ReturnType<typeof getAdminAuth>,
  input: { email: string; password: string; displayName: string },
) {
  try {
    const user = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      disabled: false,
    });
    return { uid: user.uid, created: true };
  } catch (error) {
    if (!authCode(error).includes("email-already-exists")) throw error;
    const existing = await auth.getUserByEmail(input.email);
    await auth.updateUser(existing.uid, {
      password: input.password,
      displayName: input.displayName,
      disabled: false,
    });
    return { uid: existing.uid, created: false };
  }
}

function authCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

function writeCategories(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  seeds: SeedCategory[],
  userId: string,
) {
  const now = stamp();
  for (const seed of seeds) {
    transaction.set(db.collection(collectionName).doc(seed.id), {
      name: seed.name,
      active: true,
      sortOrder: seed.sortOrder,
      systemKey: seed.systemKey,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    });
  }
}

function safeEqual(input: string, secret: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(secret);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
