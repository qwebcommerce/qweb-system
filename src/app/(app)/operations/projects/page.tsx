import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ProjectsScreen } from "@/components/operations/projects-screen";
import { listCategories } from "@/server/services/content";
import { clientOptions, listProjects } from "@/server/services/directory";

export default function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <ProjectsContent searchParams={searchParams} />
      </RequirePermission>
    </Suspense>
  );
}

async function ProjectsContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }) {
  const query = await searchParams;
  const [page, clients, types] = await Promise.all([
    listProjects({ search: query.q, status: query.status, cursor: query.cursor }),
    clientOptions(),
    listCategories("project"),
  ]);
  return <ProjectsScreen page={page} query={query} clients={clients} types={types} />;
}
