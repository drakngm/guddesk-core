import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getUserWorkspaces } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { checkWorkspaceLimits } from "@/lib/feature-flags";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { BillingPanel } from "@/components/billing/billing-panel";

export const metadata = constructMetadata({
  title: "Billing – GudDesk",
  description: "Manage your subscription and billing.",
});

export default async function AccountBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Find user's primary workspace (first workspace they own)
  const workspaces = await getUserWorkspaces(user.id!);
  const ownedWorkspace = workspaces.find((w) => w.role === "OWNER");

  if (!ownedWorkspace) {
    return (
      <>
        <DashboardHeader
          heading="Billing & Plan"
          text="Manage your subscription and billing."
        />
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          <p>Create a workspace to manage your billing and subscription.</p>
        </div>
      </>
    );
  }

  const [usage, workspace] = await Promise.all([
    checkWorkspaceLimits(ownedWorkspace.id),
    prisma.workspace.findUnique({
      where: { id: ownedWorkspace.id },
      select: { stripeCustomerId: true },
    }),
  ]);

  return (
    <>
      <DashboardHeader
        heading="Billing & Plan"
        text="Manage your subscription and billing."
      />
      <BillingPanel
        workspaceId={ownedWorkspace.id}
        plan={usage.plan}
        currentSeats={usage.currentSeats}
        maxSeats={usage.limits.maxSeats}
        currentConversations={usage.currentMonthConversations}
        maxConversations={usage.limits.maxConversationsPerMonth}
        aiEnabled={usage.limits.aiEnabled}
        hasStripe={!!workspace?.stripeCustomerId}
      />
    </>
  );
}
