import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ClientDetail } from "@/components/operations/directory-details";
import { getClient, projectsForClient, tasksFor } from "@/server/services/directory";
import { revenueFor } from "@/server/services/finance";

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <ClientContent params={params} />
      </RequirePermission>
    </Suspense>
  );
}

async function ClientContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const [projects, revenue, tasks] = await Promise.all([
    projectsForClient(id),
    revenueFor("clientId", id),
    tasksFor("clientId", id),
  ]);
  return <ClientDetail key={client.updatedAt} client={client} projects={projects} revenue={revenue} tasks={tasks} />;
}
