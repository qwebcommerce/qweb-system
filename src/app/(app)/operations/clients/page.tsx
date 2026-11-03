import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ClientsScreen } from "@/components/operations/clients-screen";
import { listClients } from "@/server/services/directory";

export default function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <ClientsContent searchParams={searchParams} />
      </RequirePermission>
    </Suspense>
  );
}

async function ClientsContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  const query = await searchParams;
  const page = await listClients({ search: query.q, status: query.status, cursor: query.cursor });
  return <ClientsScreen page={page} query={query} />;
}
