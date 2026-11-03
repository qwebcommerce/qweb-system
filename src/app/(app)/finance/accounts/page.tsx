import { Suspense } from "react";
import { AccountsScreen } from "@/components/finance/accounts-screen";
import { listAccounts, listAccountTransactions } from "@/server/services/finance";

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsContent />
    </Suspense>
  );
}

async function AccountsContent() {
  const [accounts, transactions] = await Promise.all([listAccounts(), listAccountTransactions()]);
  return <AccountsScreen accounts={accounts} transactions={transactions} />;
}
