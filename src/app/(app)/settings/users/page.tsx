import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { UsersScreen } from "@/components/settings/admin-screens";
import { listUsers } from "@/server/services/content";
import { listEmployees } from "@/server/services/directory";

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="settings.manage">
        <UsersContent />
      </RequirePermission>
    </Suspense>
  );
}

async function UsersContent() {
  const [users, employees] = await Promise.all([
    listUsers(),
    listEmployees({}),
  ]);
  return <UsersScreen users={users} employees={employees.items} />;
}
