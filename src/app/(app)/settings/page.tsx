import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanySettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const company = await getCompanySettings();
  return <SettingsScreen company={company} />;
}
