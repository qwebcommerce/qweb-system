import { Suspense } from "react";
import { RevenueScreen } from "@/components/finance/revenue-screen";
import { listCategories } from "@/server/services/content";
import { clientOptions, projectOptions } from "@/server/services/directory";
import { listAccounts, listRevenue } from "@/server/services/finance";

export default function RevenuePage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  return (
    <Suspense fallback={null}>
      <RevenueContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RevenueContent({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string }> }) {
  const query = await searchParams;
  const [page, categories, clients, projects, accounts] = await Promise.all([
    listRevenue({ search: query.q, cursor: query.cursor }),
    listCategories("revenue"),
    clientOptions(),
    projectOptions(),
    listAccounts(),
  ]);
  return <RevenueScreen page={page} query={query} categories={categories} clients={clients} projects={projects} accounts={accounts} />;
}
