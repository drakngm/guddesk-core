import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmailChannelSettings } from "@/components/settings/email-channel-settings";

export default async function EmailChannelSettingsPage({
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

  const config = await prisma.emailChannelConfig.findUnique({
    where: { workspaceId: workspace.id },
  });

  const supportAddress = `support+${workspace.appId}@mail.guddesk.com`;

  return (
    <>
      <DashboardHeader
        heading="Email Channel"
        text="Allow customers to contact your team via email."
      />

      <EmailChannelSettings
        config={config}
        workspaceId={workspace.id}
        supportAddress={supportAddress}
      />
    </>
  );
}
