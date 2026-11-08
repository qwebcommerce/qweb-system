import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import type { Period } from "@/lib/dates";
import { getSessionUser } from "@/server/auth/session";
import { loadDashboard } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

const periods = new Set<Period>(["today", "week", "month", "year", "custom"]);

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const period = periods.has(query.period as Period) ? (query.period as Period) : "month";
  const user = await getSessionUser();
  if (!user) return null;
  const data = await loadDashboard(user, period, { from: query.from, to: query.to });
  return <DashboardScreen data={data} period={period} />;
}
