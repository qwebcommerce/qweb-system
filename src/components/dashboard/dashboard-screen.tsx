"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateText, Money, Panel, StatusBadge, controlClass } from "@/components/records/widgets";
import type { DashboardData } from "@/server/services/dashboard";

const periods = ["today", "week", "month", "year", "custom"] as const;
const slices = ["#DC2626", "#2563EB", "#F59E0B", "#64748B"];

export function DashboardScreen({ data, period }: { data: DashboardData; period: string }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="max-w-3xl">
        <p className="text-sm leading-6 text-muted-foreground">{t("dashboard.intro")}</p>
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
      {data.kind === "finance" && data.figures ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={t("dashboard.revenue")} amount={data.figures.revenue} />
            <Stat label={t("dashboard.expenses")} amount={data.figures.expenses} />
            <Stat label={t("dashboard.profit")} amount={data.figures.profit} />
            <Stat label={t("dashboard.outstanding")} amount={data.figures.outstanding} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <Panel>
              <h2 className="mb-3 font-medium">{t("dashboard.chart")}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#2563EB" name={t("dashboard.revenue")} />
                    <Bar dataKey="expenses" fill="#DC2626" name={t("dashboard.expenses")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-3 font-medium">{t("dashboard.breakdown")}</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.breakdown.filter((item) => item.amount > 0)} dataKey="amount" nameKey="key" innerRadius={45} outerRadius={75}>
                      {data.breakdown.filter((item) => item.amount > 0).map((item, index) => <Cell key={item.key} fill={slices[index % slices.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-sm">
                {data.breakdown.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3">
                    <span>{t(`dashboard.${item.key}`)}</span>
                    <Money amount={item.amount} />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RecordList title={t("dashboard.recent")} rows={data.recent.map((item) => ({ id: item.id, title: item.title, date: item.date, amount: item.amount, href: item.kind === "revenue" ? "/finance/revenue" : "/finance/expenses" }))} />
            <RecordList title={t("dashboard.upcoming")} rows={data.upcoming.map((item) => ({ id: item.id, title: item.title, date: item.dueDate, amount: item.amount, status: item.status, href: "/finance/expenses" }))} />
            <RecordList title={t("dashboard.delayed")} rows={data.delayed.map((item) => ({ id: item.id, title: item.title, date: item.date, href: `/operations/projects/${item.id}` }))} />
            <Panel>
              <h2 className="mb-1 font-medium">{t("reports.title")}</h2>
              <p className="mb-3 text-sm text-muted-foreground">{t("reports.intro")}</p>
              {data.reconciliation.length === 0 ? <p className="text-sm text-muted-foreground">{t("reports.clean")}</p> : (
                <ul className="space-y-2 text-sm">
                  {data.reconciliation.map((item) => <li key={item.code}>{t(`reports.${item.code}`, { count: item.count })}</li>)}
                </ul>
              )}
              <Button className="mt-4" variant="outline" render={<Link href="/finance/reports" />}>{t("nav.reports")}</Button>
            </Panel>
          </div>
        </>
      ) : null}
      <Panel>
        <h2 className="mb-3 font-medium">{t("dashboard.tasks")}</h2>
        {data.tasks.length === 0 ? <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p> : (
          <ul className="space-y-2 text-sm">
            {data.tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3">
                <Link className="text-primary" href="/operations/tasks">{task.description}</Link>
                <span className="flex items-center gap-2"><DateText value={task.taskDate} /><StatusBadge value={task.status} /></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, amount }: { label: string; amount: number }) {
  return <Panel><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold"><Money amount={amount} /></p></Panel>;
}

function RecordList({ title, rows }: { title: string; rows: Array<{ id: string; title: string; date: string; amount?: number; status?: string; href: string }> }) {
  const { t } = useI18n();
  return (
    <Panel>
      <h2 className="mb-3 font-medium">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("common.empty")}</p> : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3">
              <Link className="truncate text-primary" href={row.href}>{row.title}</Link>
              <span className="flex shrink-0 items-center gap-2">
                <DateText value={row.date} />
                {typeof row.amount === "number" ? <Money amount={row.amount} /> : null}
                {row.status ? <StatusBadge value={row.status} /> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
