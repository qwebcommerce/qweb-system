import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { EmployeeDetail } from "@/components/operations/directory-details";
import { getEmployee, tasksFor } from "@/server/services/directory";

export default function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <RequirePermission permission="operations.view">
        <EmployeeContent params={params} />
      </RequirePermission>
    </Suspense>
  );
}

async function EmployeeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  const tasks = await tasksFor("assignedToId", id);
  return <EmployeeDetail key={employee.updatedAt} employee={employee} tasks={tasks} />;
}
