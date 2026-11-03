import { Suspense } from "react";
import { ReportsScreen } from "@/components/finance/reports-screen";
import type { Period } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { loadDashboard } from "@/server/services/dashboard";

const periods = new Set<Period>(["today", "week", "month", "year", "custom"]);

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const period = periods.has(query.period as Period) ? (query.period as Period) : "month";
  const user = await requireUser();
  const data = await loadDashboard(user, period, { from: query.from, to: query.to });
  return <ReportsScreen data={data} period={period} />;
}
