import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ActivityScreen } from "@/components/settings/admin-screens";
import { listActivity } from "@/server/services/content";

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="settings.manage">
        <ActivityContent />
      </RequirePermission>
    </Suspense>
  );
}

async function ActivityContent() {
  const rows = await listActivity();
  return <ActivityScreen rows={rows} />;
}
