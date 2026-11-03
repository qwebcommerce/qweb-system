import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="articles.view">{children}</RequirePermission>
    </Suspense>
  );
}
