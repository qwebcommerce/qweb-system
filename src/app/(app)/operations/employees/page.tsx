import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { EmployeesScreen } from "@/components/operations/employees-screen";
import { listEmployees } from "@/server/services/directory";

export default function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <EmployeesContent searchParams={searchParams} />
      </RequirePermission>
    </Suspense>
  );
}

async function EmployeesContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  const query = await searchParams;
  const page = await listEmployees({ search: query.q, status: query.status, cursor: query.cursor });
  return <EmployeesScreen page={page} query={query} />;
}
