import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { SlaPoliciesManager } from "@/components/settings/sla-policies-manager";

export default async function SlaSettingsPage({
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

  const [policies, businessHours] = await Promise.all([
    prisma.slaPolicy.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    prisma.businessHours.findUnique({
      where: { workspaceId: workspace.id },
    }),
  ]);

  return (
    <>
      <DashboardHeader
        heading="SLA Policies"
        text="Define response and resolution time targets. SLA deadlines are computed using business hours."
      />

      <SlaPoliciesManager
        policies={policies}
        businessHours={businessHours}
        workspaceId={workspace.id}
      />
    </>
  );
}
