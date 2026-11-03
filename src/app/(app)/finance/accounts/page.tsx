import { AccountsScreen } from "@/components/finance/accounts-screen";
import { listAccounts, listAccountTransactions } from "@/server/services/finance";

export default async function AccountsPage() {
  const [accounts, transactions] = await Promise.all([listAccounts(), listAccountTransactions()]);
  return <AccountsScreen accounts={accounts} transactions={transactions} />;
}
