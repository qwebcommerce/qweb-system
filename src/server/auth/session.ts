import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/config/session";
import { getAdminAuth, getAdminDb, isAdminFirebaseConfigured } from "@/lib/firebase/admin";
import { collections } from "@/config/collections";
import type { Role, SessionUser } from "@/types";

const roles = new Set<Role>(["administrator", "manager", "staff"]);

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isAdminFirebaseConfigured()) return null;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    const claimRole = decoded.role;
    if (!roles.has(claimRole) || decoded.active !== true) return null;

    const snapshot = await getAdminDb().collection(collections.users).doc(decoded.uid).get();
    if (!snapshot.exists) return null;

    const profile = snapshot.data();
    if (!profile || profile.active !== true || profile.role !== claimRole) return null;

    return {
      uid: decoded.uid,
      email: String(profile.email ?? decoded.email ?? ""),
      displayName: String(profile.displayName ?? ""),
      role: claimRole,
      employeeId: typeof profile.employeeId === "string" ? profile.employeeId : null,
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
