import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupScreen } from "@/components/auth/setup-screen";
import { PublicFrame } from "@/components/layout/public-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { getBootstrapState } from "@/server/services/settings";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <PublicFrame>
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <SetupContent />
      </Suspense>
    </PublicFrame>
  );
}

async function SetupContent() {
  const state = await getBootstrapState();
  return <SetupScreen state={state} />;
}
