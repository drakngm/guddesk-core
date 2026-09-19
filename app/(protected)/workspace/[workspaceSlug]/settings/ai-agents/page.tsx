import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceRole } from "@/lib/workspace";
import { constructMetadata } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { AgentSettings } from "@/components/settings/agent-settings";

export const metadata = constructMetadata({
  title: "AI Agents – GudDesk",
  description: "Install and manage AI agents that automate your customer support.",
});

export default async function AIAgentsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  await requireWorkspaceRole(workspace.id, user.id!, ["OWNER", "ADMIN"]);

  const agents = await prisma.agent.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      iconUrl: true,
      creatorName: true,
      creatorUrl: true,
      config: true,
      isEnabled: true,
      priority: true,
      installedAt: true,
      webhookEndpoint: {
        select: {
          id: true,
          url: true,
          isEnabled: true,
          onMessageCreated: true,
          onConversationCreated: true,
          onConversationClosed: true,
          onConversationAssigned: true,
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <DashboardHeader
        heading="AI Agents"
        text="External services that receive events and automate conversations via the API."
      />

      <AgentSettings
        workspaceId={workspace.id}
        agents={agents}
      />
    </>
  );
}
