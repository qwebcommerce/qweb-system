import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { CategoriesScreen } from "@/components/settings/admin-screens";
import { listCategories } from "@/server/services/content";

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="settings.manage">
        <CategoriesContent />
      </RequirePermission>
    </Suspense>
  );
}

async function CategoriesContent() {
  const [expense, revenue, project, article] = await Promise.all([
    listCategories("expense"),
    listCategories("revenue"),
    listCategories("project"),
    listCategories("article"),
  ]);
  return <CategoriesScreen groups={{ expense, revenue, project, article }} />;
}
