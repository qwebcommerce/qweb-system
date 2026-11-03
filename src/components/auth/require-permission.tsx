import { redirect } from "next/navigation";
import { can, type Permission } from "@/config/permissions";
import { requireUser } from "@/server/auth/session";

export async function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard");
  return children;
}
