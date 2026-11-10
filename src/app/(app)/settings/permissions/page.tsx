import { redirect } from "next/navigation";
import { Suspense } from "react";
import { flattenLinks, allowedNavigation } from "@/config/navigation";
import { PermissionsScreen } from "@/components/settings/permissions-screen";
import { getSessionUser } from "@/server/auth/session";
import { getRoleGrants } from "@/server/services/permissions";

export default function PermissionsPage() {
  return (
    <Suspense fallback={null}>
      <PermissionsContent />
    </Suspense>
  );
}

async function PermissionsContent() {
  const [user, grants] = await Promise.all([getSessionUser(), getRoleGrants()]);
  if (!user) return null;
  if (user.role !== "administrator") {
    const next = flattenLinks(allowedNavigation(user.role, grants)).find((link) => link.href !== "/settings/permissions");
    redirect(next?.href ?? "/dashboard");
  }
  return <PermissionsScreen grants={grants} />;
}
