import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { TicketFormsManager } from "@/components/settings/ticket-forms-manager";

export default async function TicketFormsPage({
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

  const [forms, customFields] = await Promise.all([
    prisma.ticketForm.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customField.findMany({
      where: { workspaceId: workspace.id, entityType: "conversation" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <>
      <DashboardHeader
        heading="Ticket Forms"
        text="Create intake forms that define which custom fields are shown when starting a conversation."
      />

      <TicketFormsManager
        forms={forms}
        customFields={customFields}
        workspaceId={workspace.id}
      />
    </>
  );
}
