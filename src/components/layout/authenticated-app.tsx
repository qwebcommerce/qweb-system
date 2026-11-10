import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SessionReset } from "@/components/layout/session-reset";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { CompanyProvider } from "@/components/providers/company-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { getSessionUser } from "@/server/auth/session";
import { getRoleGrants } from "@/server/services/permissions";
import { getCompanySettings } from "@/server/services/settings";

export function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedContent>{children}</AuthenticatedContent>
    </Suspense>
  );
}

async function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  const [user, grants, company] = await Promise.all([getSessionUser(), getRoleGrants(), getCompanySettings()]);
  if (!user) return <SessionReset />;

  return (
    <UserProvider user={user}>
      <PermissionsProvider grants={grants}>
        <CompanyProvider company={company}>
          <AppShell>{children}</AppShell>
        </CompanyProvider>
      </PermissionsProvider>
    </UserProvider>
  );
}
