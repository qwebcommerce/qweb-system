import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getPublicFirebaseConfig, isPublicFirebaseConfigured } from "@/lib/firebase/public-config";

export function getFirebaseApp(): FirebaseApp {
  if (!isPublicFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  if (getApps().length > 0) return getApp();
  return initializeApp(getPublicFirebaseConfig());
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
}
