import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import {
  getPlatformConversationStats,
  getAiUsageStats,
  getTopWorkspaces,
} from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { PlatformConversationsChart } from "@/components/admin/platform-conversations-chart";
import { PlatformMessagesChart } from "@/components/admin/platform-messages-chart";
import { AiUsageChart } from "@/components/admin/ai-usage-chart";
import { TopWorkspacesTable } from "@/components/admin/top-workspaces-table";

export const metadata = constructMetadata({
  title: "Analytics – Admin – GudDesk",
  description: "Platform-wide analytics.",
});

interface AnalyticsPageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const params = await searchParams;
  const days = Math.min(90, Math.max(7, parseInt(params.days ?? "30", 10) || 30));

  const [conversationStats, aiUsage, topWorkspaces] = await Promise.all([
    getPlatformConversationStats(days),
    getAiUsageStats(days),
    getTopWorkspaces(10),
  ]);

  return (
    <>
      <DashboardHeader
        heading="Platform Analytics"
        text={`Last ${days} days across all workspaces.`}
      />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <PlatformConversationsChart data={conversationStats} />
          <PlatformMessagesChart data={conversationStats} />
        </div>
        <AiUsageChart data={aiUsage} />
        <TopWorkspacesTable workspaces={topWorkspaces} />
      </div>
    </>
  );
}
