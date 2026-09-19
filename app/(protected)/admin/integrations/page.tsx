import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getIntegrationsList } from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { IntegrationsTable } from "@/components/admin/integrations-table";

export const metadata = constructMetadata({
  title: "Integrations – Admin – GudDesk",
  description: "Manage integrations across all workspaces.",
});

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: "slack" | "widget" | "help-center";
  }>;
}

export default async function AdminIntegrationsPage({
  searchParams,
}: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const params = await searchParams;

  const { integrations, stats } = await getIntegrationsList(
    params.search,
    params.type ? { type: params.type } : undefined,
  );

  // Serialize dates for client component
  const serialized = integrations.map((i) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  return (
    <>
      <DashboardHeader
        heading="Integrations"
        text="Overview of all workspace integrations across the platform."
      />
      <div className="flex flex-col gap-5">
        <IntegrationsTable integrations={serialized} stats={stats} />
      </div>
    </>
  );
}
