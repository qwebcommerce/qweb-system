import { redirect } from "next/navigation";
import { flattenLinks, allowedNavigation } from "@/config/navigation";
import { can, type Permission } from "@/config/permissions";
import { getSessionUser } from "@/server/auth/session";
import { getRoleGrants } from "@/server/services/permissions";

export async function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const grants = await getRoleGrants();
  if (!can(user.role, permission, grants)) {
    const next = flattenLinks(allowedNavigation(user.role, grants)).find((link) => link.permission !== permission);
    redirect(next?.href ?? "/dashboard");
  }
  return children;
}
