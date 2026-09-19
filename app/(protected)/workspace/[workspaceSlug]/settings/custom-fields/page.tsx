import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { CustomFieldsManager } from "@/components/settings/custom-fields-manager";

export default async function CustomFieldsPage({
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

  const customFields = await prisma.customField.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <DashboardHeader
        heading="Custom Fields"
        text="Define structured attributes for customers and companies. Values are stored in metadata."
      />

      <CustomFieldsManager
        fields={customFields}
        workspaceId={workspace.id}
      />
    </>
  );
}
