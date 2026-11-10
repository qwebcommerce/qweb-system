import "server-only";
import { cache } from "react";
import { collections } from "@/config/collections";
import { defaultRolePermissions, normalizeGrants, type RoleGrants } from "@/config/permissions";
import { database, live } from "@/server/db";

export const getRoleGrants = cache(async (): Promise<RoleGrants> => {
  await live();
  const snapshot = await database().collection(collections.settings).doc("permissions").get();
  if (!snapshot.exists) return defaultRolePermissions;
  return normalizeGrants(snapshot.data());
});
