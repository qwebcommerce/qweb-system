import type { Role } from "@/types";

export const permissions = [
  "dashboard.view",
  "finance.view",
  "operations.view",
  "tasks.view",
  "articles.view",
  "settings.view",
  "settings.manage",
] as const;

export type Permission = (typeof permissions)[number];

export type RoleGrants = Record<Role, Permission[]>;

export const defaultRolePermissions: RoleGrants = {
  administrator: [...permissions],
  manager: ["dashboard.view", "finance.view", "operations.view", "tasks.view", "articles.view", "settings.view"],
  staff: ["dashboard.view", "tasks.view", "settings.view"],
};

const knownPermissions = new Set<string>(permissions);

export function normalizeGrants(value: unknown): RoleGrants {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    administrator: [...permissions],
    manager: cleanList(record.manager, defaultRolePermissions.manager),
    staff: cleanList(record.staff, defaultRolePermissions.staff),
  };
}

export function can(role: Role, permission: Permission, grants: RoleGrants = defaultRolePermissions): boolean {
  if (role === "administrator") return true;
  return grants[role].includes(permission);
}

function cleanList(value: unknown, fallback: readonly Permission[]): Permission[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is Permission => typeof item === "string" && knownPermissions.has(item)))];
}
