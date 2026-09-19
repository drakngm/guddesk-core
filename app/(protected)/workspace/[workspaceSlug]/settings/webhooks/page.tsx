import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceRole } from "@/lib/workspace";
import { DashboardHeader } from "@/components/dashboard/header";
import { WebhookSettings } from "@/components/integrations/webhook-settings";

export default async function WebhooksPage({
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

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      description: true,
      isEnabled: true,
      onMessageCreated: true,
      onConversationCreated: true,
      onConversationClosed: true,
      onConversationAssigned: true,
      createdAt: true,
      _count: {
        select: { deliveries: true },
      },
    },
  });

  return (
    <>
      <DashboardHeader
        heading="Webhooks"
        text="Send real-time event notifications to external services."
      />
      <WebhookSettings
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        endpoints={endpoints.map((ep) => ({
          ...ep,
          deliveryCount: ep._count.deliveries,
        }))}
      />
    </>
  );
}
