import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { ProjectDetail } from "@/components/operations/project-detail";
import { listCategories } from "@/server/services/content";
import { clientOptions, getProject, listActiveEmployees, listLabor, listMembers, tasksFor } from "@/server/services/directory";
import { expensesFor, revenueFor } from "@/server/services/finance";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <ProjectContent params={params} />
      </RequirePermission>
    </Suspense>
  );
}

async function ProjectContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [clients, types, expenses, revenue, tasks, members, labor, employees] = await Promise.all([
    clientOptions(),
    listCategories("project"),
    expensesFor("projectId", id),
    revenueFor("projectId", id),
    tasksFor("projectId", id),
    listMembers(id),
    listLabor(id),
    listActiveEmployees(),
  ]);
  return (
    <ProjectDetail
      key={project.updatedAt}
      project={project}
      clients={clients}
      types={types}
      expenses={expenses}
      revenue={revenue}
      tasks={tasks}
      members={members}
      labor={labor}
      employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName, hourlyCost: employee.hourlyCost }))}
    />
  );
}
