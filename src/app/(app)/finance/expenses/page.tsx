import { ExpensesScreen } from "@/components/finance/expenses-screen";
import { listCategories } from "@/server/services/content";
import { clientOptions, projectOptions } from "@/server/services/directory";
import { listAccounts, listExpenses, listSchedules } from "@/server/services/finance";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cursor?: string }>;
}) {
  const query = await searchParams;
  const [page, categories, clients, projects, accounts, schedules] = await Promise.all([
    listExpenses({ search: query.q, status: query.status, cursor: query.cursor }),
    listCategories("expense"),
    clientOptions(),
    projectOptions(),
    listAccounts(),
    listSchedules(),
  ]);
  return <ExpensesScreen page={page} query={query} categories={categories} clients={clients} projects={projects} accounts={accounts} schedules={schedules} />;
}
