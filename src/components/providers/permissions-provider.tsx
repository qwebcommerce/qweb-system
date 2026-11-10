"use client";

import { createContext, use } from "react";
import { can, defaultRolePermissions, type Permission, type RoleGrants } from "@/config/permissions";
import { useCurrentUser } from "@/components/providers/user-provider";

const GrantsContext = createContext<RoleGrants>(defaultRolePermissions);

export function PermissionsProvider({ grants, children }: { grants: RoleGrants; children: React.ReactNode }) {
  return <GrantsContext value={grants}>{children}</GrantsContext>;
}

export function useRoleGrants() {
  return use(GrantsContext);
}

export function useCan() {
  const user = useCurrentUser();
  const grants = useRoleGrants();
  return (permission: Permission) => can(user.role, permission, grants);
}
