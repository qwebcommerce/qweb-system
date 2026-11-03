import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/config/session";
import { collections } from "@/config/collections";
import { getAdminAuth, getAdminDb, isAdminFirebaseConfigured } from "@/lib/firebase/admin";
import type { Role } from "@/types";

const roles = new Set<Role>(["administrator", "manager", "staff"]);

export async function POST(request: Request) {
  if (!isAdminFirebaseConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { idToken?: string } | null;
  const idToken = body?.idToken;
  if (!idToken) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const snapshot = await getAdminDb().collection(collections.users).doc(decoded.uid).get();
    const profile = snapshot.data();
    const claimRole = decoded.role;

    if (
      !profile ||
      profile.active !== true ||
      !roles.has(claimRole) ||
      profile.role !== claimRole ||
      decoded.active !== true
    ) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const session = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
