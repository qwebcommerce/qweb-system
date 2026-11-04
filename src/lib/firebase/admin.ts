import "server-only";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import type { App, ServiceAccount } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

interface ServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

type FirestoreModule = typeof import("firebase-admin/firestore");

interface ReadyAdmin {
  auth: Auth;
  db: Firestore;
  FieldValue: FirestoreModule["FieldValue"];
  Timestamp: FirestoreModule["Timestamp"];
}

const globalAdmin = globalThis as typeof globalThis & { __qwebAdmin?: ReadyAdmin };

type AppModule = typeof import("firebase-admin/app");
type AuthModule = typeof import("firebase-admin/auth");

function firebasePackageRequire() {
  const starts = [process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let depth = 0; depth < 6; depth += 1) {
      const packageJson = path.join(dir, "node_modules", "firebase-admin", "package.json");
      if (existsSync(packageJson)) return createRequire(packageJson);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("firebase-admin is not installed on the server.");
}

function loadInstalledModules(): [AppModule, AuthModule, FirestoreModule] {
  const nodeRequire = firebasePackageRequire();
  const name = "firebase-admin";
  return [
    nodeRequire(`${name}/app`),
    nodeRequire(`${name}/auth`),
    nodeRequire(`${name}/firestore`),
  ];
}

async function loadBundledModules(): Promise<[AppModule, AuthModule, FirestoreModule]> {
  return Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth"),
    import("firebase-admin/firestore"),
  ]);
}

function parseServiceAccount(raw: string): ServiceAccountFile {
  try {
    return JSON.parse(raw) as ServiceAccountFile;
  } catch {
    const repaired = raw.replace(
      /("private_key"\s*:\s*")([\s\S]*?)("\s*[,}])/,
      (_match, start: string, key: string, end: string) => `${start}${key.replace(/\r?\n/g, "\\n")}${end}`,
    );
    return JSON.parse(repaired) as ServiceAccountFile;
  }
}

function normalizePrivateKey(key: string): string {
  const unescaped = key.replace(/\\n/g, "\n").trim();
  if (unescaped.includes("\n")) return unescaped;
  const match = unescaped.match(/^-----BEGIN ([A-Z ]+)-----([A-Za-z0-9+/=]+)-----END \1-----$/);
  if (!match) return unescaped;
  const body = match[2].match(/.{1,64}/g)?.join("\n") ?? match[2];
  return `-----BEGIN ${match[1]}-----\n${body}\n-----END ${match[1]}-----\n`;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_ADMIN_CONFIG?.trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return null;

  try {
    const parsed = parseServiceAccount(raw);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  } catch {
    return null;
  }
}

export function isAdminFirebaseConfigured(): boolean {
  return readServiceAccount() !== null;
}

export async function readyFirebase(): Promise<ReadyAdmin> {
  if (globalAdmin.__qwebAdmin) return globalAdmin.__qwebAdmin;
  let modules: [AppModule, AuthModule, FirestoreModule];
  try {
    modules = loadInstalledModules();
  } catch (installedError) {
    try {
      modules = await loadBundledModules();
    } catch (bundledError) {
      const installed = installedError instanceof Error ? installedError.message : "installed load failed";
      const bundled = bundledError instanceof Error ? bundledError.message : "bundled load failed";
      throw new Error(`${installed} | ${bundled}`);
    }
  }
  const [{ cert, getApps, initializeApp }, { getAuth }, firestore] = modules;
  const existing = getApps()[0];
  let app: App;
  if (existing) {
    app = existing;
  } else {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount) throw new Error("Firebase Admin is not configured.");
    app = initializeApp({ credential: cert(serviceAccount) });
  }
  globalAdmin.__qwebAdmin = {
    auth: getAuth(app),
    db: firestore.getFirestore(app),
    FieldValue: firestore.FieldValue,
    Timestamp: firestore.Timestamp,
  };
  return globalAdmin.__qwebAdmin;
}

export function getAdminAuth(): Auth {
  if (!globalAdmin.__qwebAdmin) throw new Error("Firebase Admin is not ready.");
  return globalAdmin.__qwebAdmin.auth;
}

export function getAdminDb(): Firestore {
  if (!globalAdmin.__qwebAdmin) throw new Error("Firebase Admin is not ready.");
  return globalAdmin.__qwebAdmin.db;
}

export function adminFieldValue(): ReadyAdmin["FieldValue"] {
  if (!globalAdmin.__qwebAdmin) throw new Error("Firebase Admin is not ready.");
  return globalAdmin.__qwebAdmin.FieldValue;
}

export function adminTimestamp(): ReadyAdmin["Timestamp"] {
  if (!globalAdmin.__qwebAdmin) throw new Error("Firebase Admin is not ready.");
  return globalAdmin.__qwebAdmin.Timestamp;
}
