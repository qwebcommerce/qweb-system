import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { TasksScreen } from "@/components/operations/tasks-screen";
import { getSessionUser } from "@/server/auth/session";
import { clientOptions, listPeopleOptions, listTaskBoard, projectOptions } from "@/server/services/directory";

const views = new Set(["all", "today", "upcoming", "overdue", "mine", "completed"]);

export default function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="tasks.view">
        <TasksContent searchParams={searchParams} />
      </RequirePermission>
    </Suspense>
  );
}

async function TasksContent({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const view = views.has(query.view ?? "") ? (query.view as "all" | "today" | "upcoming" | "overdue" | "mine" | "completed") : "all";
  const user = await getSessionUser();
  if (!user) return null;
  const [tasks, clients, projects, people] = await Promise.all([
    listTaskBoard(user, view),
    clientOptions(),
    projectOptions(),
    listPeopleOptions(),
  ]);
  return <TasksScreen tasks={tasks} view={view} clients={clients} projects={projects} people={people} />;
}
