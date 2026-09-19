import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspacesList } from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { WorkspacesTable } from "@/components/admin/workspaces-table";

export const metadata = constructMetadata({
  title: "Workspaces – Admin – GudDesk",
  description: "Manage platform workspaces.",
});

interface WorkspacesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    plan?: string;
  }>;
}

export default async function AdminWorkspacesPage({ searchParams }: WorkspacesPageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.search || undefined;
  const planFilter = params.plan === "FREE" || params.plan === "PRO" ? params.plan : undefined;

  const data = await getWorkspacesList(page, 20, search, {
    plan: planFilter,
  });

  return (
    <>
      <DashboardHeader heading="Workspaces" text="Manage platform workspaces." />
      <WorkspacesTable
        workspaces={data.workspaces}
        total={data.total}
        totalPages={data.totalPages}
        page={data.page}
      />
    </>
  );
}
