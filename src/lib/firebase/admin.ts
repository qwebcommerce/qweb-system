import "server-only";
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

let ready: ReadyAdmin | null = null;

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
  if (ready) return ready;
  const [{ cert, getApps, initializeApp }, { getAuth }, firestore] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth"),
    import("firebase-admin/firestore"),
  ]);
  const existing = getApps()[0];
  let app: App;
  if (existing) {
    app = existing;
  } else {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount) throw new Error("Firebase Admin is not configured.");
    app = initializeApp({ credential: cert(serviceAccount) });
  }
  ready = {
    auth: getAuth(app),
    db: firestore.getFirestore(app),
    FieldValue: firestore.FieldValue,
    Timestamp: firestore.Timestamp,
  };
  return ready;
}

export function getAdminAuth(): Auth {
  if (!ready) throw new Error("Firebase Admin is not ready.");
  return ready.auth;
}

export function getAdminDb(): Firestore {
  if (!ready) throw new Error("Firebase Admin is not ready.");
  return ready.db;
}

export function adminFieldValue(): ReadyAdmin["FieldValue"] {
  if (!ready) throw new Error("Firebase Admin is not ready.");
  return ready.FieldValue;
}

export function adminTimestamp(): ReadyAdmin["Timestamp"] {
  if (!ready) throw new Error("Firebase Admin is not ready.");
  return ready.Timestamp;
}
