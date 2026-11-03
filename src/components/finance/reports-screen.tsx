"use client";

import Link from "next/link";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Money, Panel, controlClass } from "@/components/records/widgets";
import type { DashboardData } from "@/server/services/dashboard";

const periods = ["today", "week", "month", "year", "custom"] as const;

export function ReportsScreen({ data, period }: { data: DashboardData; period: string }) {
  const { t } = useI18n();
  const figures = data.figures;
  const cash = data.cash;

  function exportReport() {
    const rows: Array<Array<string | number>> = [];
    if (cash) {
      rows.push(["cash", t("dashboard.cash"), cash.cash, ""]);
      rows.push(["cash", t("dashboard.bank"), cash.bank, ""]);
      rows.push(["cash", t("dashboard.available"), cash.available, ""]);
    }
    for (const account of data.accounts) rows.push(["account", account.name, account.balance, account.type]);
    for (const project of data.projects) rows.push(["project", project.title, project.profit, project.expenses]);
    for (const employee of data.laborByEmployee) rows.push(["labor", employee.name, employee.cost, employee.hours]);
    for (const item of data.reconciliation) rows.push(["reconciliation", item.code, item.count, ""]);
    downloadCsv("reports.csv", toCsv(["section", "name", "amount", "detail"], rows));
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">{t("reports.intro")}</p>
        <Button type="button" variant="outline" onClick={exportReport}>{t("reports.export")}</Button>
      </section>
      <Panel>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="space-y-2">
            <span className="text-sm font-medium">{t("dashboard.period")}</span>
            <select className={controlClass} name="period" defaultValue={period}>
              {periods.map((item) => <option key={item} value={item}>{t(`dashboard.${item}`)}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">{t("dashboard.from")}</span>
            <Input className="numeric h-10 w-40" type="date" name="from" defaultValue={data.range.from} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">{t("dashboard.to")}</span>
            <Input className="numeric h-10 w-40" type="date" name="to" defaultValue={data.range.to} />
          </label>
          <Button type="submit" variant="outline">{t("dashboard.apply")}</Button>
        </form>
      </Panel>
      <p className="text-sm leading-6 text-muted-foreground">{t("dashboard.positionHint")}</p>
      {figures && cash ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t("dashboard.revenue")} amount={figures.revenue} />
          <Stat label={t("dashboard.expenses")} amount={figures.expenses} />
          <Stat label={t("dashboard.profit")} amount={figures.profit} />
          <Stat label={t("dashboard.available")} amount={cash.available} />
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-medium">{t("reports.cashFlow")}</h2>
          <div className="space-y-2 text-sm">
            <Row label={t("dashboard.cash")} amount={cash?.cash ?? 0} />
            <Row label={t("dashboard.bank")} amount={cash?.bank ?? 0} />
            <Row label={t("dashboard.payroll")} amount={figures?.payroll ?? 0} />
            <Row label={t("dashboard.pending")} amount={figures?.pending ?? 0} />
          </div>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-medium">{t("reports.accountBalances")}</h2>
          {data.accounts.length === 0 ? <p className="text-sm text-muted-foreground">{t("accounts.empty")}</p> : (
            <ul className="space-y-2 text-sm">
              {data.accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3">
                  <Link className="text-primary" href="/finance/accounts">{account.name}</Link>
                  <span className="flex items-center gap-2 text-muted-foreground"><span>{t(`status.${account.type}`)}</span><Money amount={account.balance} /></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel>
        <h2 className="mb-3 font-medium">{t("reports.projectProfit")}</h2>
        {data.projects.length === 0 ? <p className="text-sm text-muted-foreground">{t("projects.empty")}</p> : (
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.name")}</th>
                <th className="px-2 py-2 font-medium">{t("nav.expenses")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.labor")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.netProfit")}</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => (
                <tr key={project.id} className="border-t border-border">
                  <td className="px-2 py-2"><Link className="text-primary" href={`/operations/projects/${project.id}`}>{project.title}</Link></td>
                  <td className="px-2 py-2"><Money amount={project.expenses} /></td>
                  <td className="px-2 py-2"><Money amount={project.labor} /></td>
                  <td className="px-2 py-2"><Money amount={project.profit} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
      <Panel>
        <h2 className="mb-3 font-medium">{t("reports.laborReport")}</h2>
        {data.laborByEmployee.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
          <DataTable>
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="px-2 py-2 font-medium">{t("fields.employee")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.hours")}</th>
                <th className="px-2 py-2 font-medium">{t("fields.labor")}</th>
              </tr>
            </thead>
            <tbody>
              {data.laborByEmployee.map((employee) => (
                <tr key={employee.id} className="border-t border-border">
                  <td className="px-2 py-2">{employee.name}</td>
                  <td className="numeric px-2 py-2">{employee.hours}</td>
                  <td className="px-2 py-2"><Money amount={employee.cost} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
      <Panel>
        <h2 className="mb-1 font-medium">{t("reports.title")}</h2>
        {data.reconciliation.length === 0 ? <p className="text-sm text-muted-foreground">{t("reports.clean")}</p> : (
          <ul className="space-y-2 text-sm">
            {data.reconciliation.map((item) => <li key={item.code}>{t(`reports.${item.code}`, { count: item.count })}</li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, amount }: { label: string; amount: number }) {
  return <Panel><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold"><Money amount={amount} /></p></Panel>;
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd><Money amount={amount} /></dd>
    </div>
  );
}
