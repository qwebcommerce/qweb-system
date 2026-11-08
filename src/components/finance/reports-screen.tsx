"use client";

import Link from "next/link";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money, Panel, controlClass } from "@/components/records/widgets";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/server/services/dashboard";

const periods = ["today", "week", "month", "year", "custom"] as const;
const panelClass = "border-t-2 border-[#550000] bg-[#faf6f6] ring-[#550000]/15 dark:bg-[#160909] dark:ring-[#550000]/40";
const headClass = "bg-[#550000] px-5 py-3 text-start font-medium text-white";

export function ReportsScreen({ data, period }: { data: DashboardData; period: string }) {
  const { t } = useI18n();
  const figures = data.figures;

  function exportReport() {
    const rows: Array<Array<string | number>> = [];
    if (figures) {
      rows.push(["period", t("dashboard.revenue"), figures.revenue, ""]);
      rows.push(["period", t("dashboard.expenses"), figures.expenses, ""]);
      rows.push(["period", t("dashboard.profit"), figures.profit, ""]);
      rows.push(["period", t("dashboard.pending"), figures.pending, ""]);
      rows.push(["period", t("dashboard.payroll"), figures.payroll, ""]);
      rows.push(["period", t("dashboard.labor"), figures.labor, ""]);
    }
    for (const project of data.projects) rows.push(["project", project.title, project.profit, project.expenses]);
    for (const employee of data.laborByEmployee) rows.push(["labor", employee.name, employee.cost, employee.hours]);
    for (const item of data.reconciliation) rows.push(["reconciliation", item.code, item.count, ""]);
    downloadCsv("reports.csv", toCsv(["section", "name", "amount", "detail"], rows));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <p className="text-sm leading-6 text-muted-foreground">{t("reports.intro")}</p>
      <Panel className={cn(panelClass, "p-4 sm:p-5 md:p-6")}>
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:items-end" method="get">
          <label className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:w-56">
            <span className="text-sm font-medium">{t("dashboard.period")}</span>
            <select className={cn(controlClass, "max-w-full")} name="period" defaultValue={period}>
              {periods.map((item) => <option key={item} value={item}>{t(`dashboard.${item}`)}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-2 lg:w-48">
            <span className="text-sm font-medium">{t("dashboard.from")}</span>
            <Input className="numeric h-10 w-full min-w-0 max-w-full" type="date" name="from" defaultValue={data.range.from} />
          </label>
          <label className="flex min-w-0 flex-col gap-2 lg:w-48">
            <span className="text-sm font-medium">{t("dashboard.to")}</span>
            <Input className="numeric h-10 w-full min-w-0 max-w-full" type="date" name="to" defaultValue={data.range.to} />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:flex lg:w-auto">
            <Button type="submit" variant="outline" className="h-10 w-full px-6 lg:w-auto">{t("dashboard.apply")}</Button>
            <Button type="button" variant="outline" className="h-10 w-full px-6 lg:w-auto" onClick={exportReport}>{t("reports.export")}</Button>
          </div>
        </form>
      </Panel>
      {figures ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label={t("dashboard.revenue")} amount={figures.revenue} />
          <Stat label={t("dashboard.expenses")} amount={figures.expenses} />
          <Stat label={t("dashboard.profit")} amount={figures.profit} tone="emphasis" />
          <Stat label={t("dashboard.pending")} amount={figures.pending} />
          <Stat label={t("dashboard.payroll")} amount={figures.payroll} />
          <Stat label={t("dashboard.labor")} amount={figures.labor} />
        </div>
      ) : null}
      <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
        <h2 className="px-4 py-4 font-medium sm:px-5">{t("reports.projectProfit")}</h2>
        {data.projects.length === 0 ? <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">{t("projects.empty")}</p> : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className={cn("w-[40%]", headClass)}>{t("fields.name")}</th>
                  <th className={cn("w-[20%]", headClass)}>{t("nav.expenses")}</th>
                  <th className={cn("w-[20%]", headClass)}>{t("fields.labor")}</th>
                  <th className={cn("w-[20%]", headClass)}>{t("fields.netProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr key={project.id} className="border-t border-[#550000]/10">
                    <td className="px-3 py-3 text-start md:px-5"><Link className="font-medium break-words text-primary" href={`/operations/projects/${project.id}`}>{project.title}</Link></td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={project.expenses} /></td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={project.labor} /></td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={project.profit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel className="min-w-0 overflow-hidden p-0 md:p-0">
        <h2 className="px-4 py-4 font-medium sm:px-5">{t("reports.laborReport")}</h2>
        {data.laborByEmployee.length === 0 ? <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">{t("common.empty")}</p> : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[32rem] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className={cn("w-[50%]", headClass)}>{t("fields.employee")}</th>
                  <th className={cn("w-[25%]", headClass)}>{t("fields.hours")}</th>
                  <th className={cn("w-[25%]", headClass)}>{t("fields.labor")}</th>
                </tr>
              </thead>
              <tbody>
                {data.laborByEmployee.map((employee) => (
                  <tr key={employee.id} className="border-t border-[#550000]/10">
                    <td className="px-3 py-3 text-start font-medium break-words md:px-5">{employee.name}</td>
                    <td className="numeric px-3 py-3 text-start md:px-5">{employee.hours}</td>
                    <td className="px-3 py-3 text-start whitespace-nowrap md:px-5"><Money amount={employee.cost} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel className={cn(panelClass, "p-5 md:p-6")}>
        <h2 className="font-medium">{t("reports.title")}</h2>
        {data.reconciliation.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("reports.clean")}</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.reconciliation.map((item) => <li key={item.code}>{t(`reports.${item.code}`, { count: item.count })}</li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, amount, tone = "default" }: { label: string; amount: number; tone?: "default" | "emphasis" }) {
  const emphasis = tone === "emphasis";
  return (
    <section
      className={cn(
        "rounded-xl p-4 ring-1 md:p-5",
        emphasis
          ? "bg-[#550000] text-white ring-[#550000]"
          : "border-t-2 border-[#550000] bg-[#f6ecec] ring-[#550000]/15 dark:bg-[#241212] dark:text-white dark:ring-[#550000]/40",
      )}
    >
      <p className={cn("text-sm", emphasis ? "text-white/75" : "text-[#550000] dark:text-[#d4b4b4]")}>{label}</p>
      <p className="mt-2 break-words text-lg font-semibold leading-tight sm:text-xl"><Money amount={amount} /></p>
    </section>
  );
}
