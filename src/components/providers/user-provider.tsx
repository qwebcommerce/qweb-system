"use client";

import { createContext, use } from "react";
import type { SessionUser } from "@/types";

const UserContext = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <UserContext value={user}>{children}</UserContext>;
}

export function useCurrentUser() {
  const user = use(UserContext);
  if (!user) throw new Error("useCurrentUser must be used within UserProvider");
  return user;
}
