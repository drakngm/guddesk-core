import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { ApiKeySettings } from "@/components/settings/api-key-display";

export const metadata = constructMetadata({
  title: "API Keys – GudDesk",
  description: "Create and manage your API keys.",
});

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect("/login");

  // Fetch user's workspaces for the workspace selector
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  const workspaces = memberships.map((m) => m.workspace);

  // Fetch all API keys for this user
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permission: true,
      isEnabled: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      workspaceId: true,
    },
  });

  return (
    <>
      <DashboardHeader
        heading="API Keys"
        text="Create and manage API keys to connect external services and agents to your account."
      />
      <ApiKeySettings workspaces={workspaces} apiKeys={apiKeys} />
    </>
  );
}
