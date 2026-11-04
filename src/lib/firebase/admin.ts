import "server-only";
import { createRequire } from "node:module";
import path from "node:path";
import type { App, ServiceAccount } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

interface ServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function load(name: string) {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  return require(name);
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

function firebaseAppModule(): {
  cert: (account: ServiceAccount) => object;
  getApps: () => App[];
  initializeApp: (options: { credential: object }) => App;
} {
  return load("firebase-admin/app");
}

function firebaseAuthModule(): { getAuth: (app: App) => Auth } {
  return load("firebase-admin/auth");
}

function firebaseFirestoreModule(): { getFirestore: (app: App) => Firestore } {
  return load("firebase-admin/firestore");
}

export function isAdminFirebaseConfigured(): boolean {
  return readServiceAccount() !== null;
}

function getAdminApp(): App {
  const { getApps, initializeApp, cert } = firebaseAppModule();
  if (getApps().length > 0) return getApps()[0]!;
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    throw new Error("Firebase Admin is not configured.");
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export function getAdminAuth(): Auth {
  return firebaseAuthModule().getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return firebaseFirestoreModule().getFirestore(getAdminApp());
}
