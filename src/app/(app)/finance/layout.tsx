import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="finance.view">{children}</RequirePermission>
    </Suspense>
  );
}
