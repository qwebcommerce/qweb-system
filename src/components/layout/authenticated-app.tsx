import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SessionReset } from "@/components/layout/session-reset";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { CompanyProvider } from "@/components/providers/company-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { getSessionUser } from "@/server/auth/session";
import { getCompanySettings } from "@/server/services/settings";

export function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedContent>{children}</AuthenticatedContent>
    </Suspense>
  );
}

async function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return <SessionReset />;
  const company = await getCompanySettings();

  return (
    <UserProvider user={user}>
      <CompanyProvider company={company}>
        <AppShell>{children}</AppShell>
      </CompanyProvider>
    </UserProvider>
  );
}
