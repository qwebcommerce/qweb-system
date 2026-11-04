import "server-only";
import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

interface ServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
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

function getAdminApp(): App {
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
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
