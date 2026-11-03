import { Suspense } from "react";
import { PayrollScreen } from "@/components/finance/payroll-screen";
import { qatarToday } from "@/lib/dates";
import { listAccounts, listPayroll } from "@/server/services/finance";

export default function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  return (
    <Suspense fallback={null}>
      <PayrollContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PayrollContent({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const query = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : qatarToday().slice(0, 7);
  const [rows, accounts] = await Promise.all([listPayroll(month), listAccounts()]);
  return <PayrollScreen rows={rows} month={month} accounts={accounts} />;
}
