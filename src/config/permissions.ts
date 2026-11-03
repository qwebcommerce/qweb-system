import type { Role } from "@/types";

export const rolePermissions = {
  administrator: [
    "dashboard.view",
    "finance.view",
    "operations.view",
    "tasks.view",
    "articles.view",
    "settings.view",
    "settings.manage",
  ],
  manager: [
    "dashboard.view",
    "finance.view",
    "operations.view",
    "tasks.view",
    "articles.view",
    "settings.view",
  ],
  staff: ["dashboard.view", "tasks.view", "settings.view"],
} as const;

export type Permission = (typeof rolePermissions.administrator)[number];

export function can(role: Role, permission: Permission): boolean {
  return (rolePermissions[role] as readonly string[]).includes(permission);
}
