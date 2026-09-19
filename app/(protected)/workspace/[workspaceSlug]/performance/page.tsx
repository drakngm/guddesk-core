import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { getAgentPerformanceData } from "@/lib/agent-analytics";
import { DashboardHeader } from "@/components/dashboard/header";
import { AgentPerformanceDashboard } from "@/components/analytics/agent-performance-dashboard";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  await requireWorkspaceMember(workspace.id, user.id!);

  const data = await getAgentPerformanceData(workspace.id, 30);

  return (
    <>
      <DashboardHeader
        heading="Agent Performance"
        text="Per-agent metrics for the past 30 days."
      />
      <AgentPerformanceDashboard data={data} />
    </>
  );
}
