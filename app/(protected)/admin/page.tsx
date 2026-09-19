import { DollarSign, MessageSquare, Users, Building } from "lucide-react";

import {
  getPlatformStats,
  getPlatformGrowth,
  getRecentAuditLogs,
} from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatCard } from "@/components/admin/stat-card";
import { GrowthChart } from "@/components/admin/growth-chart";
import { PlanDistribution } from "@/components/admin/plan-distribution";
import { RecentActivity } from "@/components/admin/recent-activity";

export const metadata = constructMetadata({
  title: "Admin – GudDesk",
  description: "Platform administration dashboard.",
});

export default async function AdminPage() {
  const [stats, growth, auditLogs] = await Promise.all([
    getPlatformStats(),
    getPlatformGrowth(30),
    getRecentAuditLogs(10),
  ]);

  return (
    <>
      <DashboardHeader
        heading="Admin Panel"
        text="Platform overview and management."
      />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
          />
          <StatCard
            title="Total Workspaces"
            value={stats.totalWorkspaces.toLocaleString()}
            icon={Building}
          />
          <StatCard
            title="Active Conversations"
            value={stats.activeConversations.toLocaleString()}
            icon={MessageSquare}
          />
          <StatCard
            title="Estimated MRR"
            value={`$${stats.estimatedMrr.toLocaleString()}`}
            description={`${stats.proWorkspaces} Pro workspaces`}
            icon={DollarSign}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GrowthChart data={growth} />
          </div>
          <PlanDistribution
            freeWorkspaces={stats.freeWorkspaces}
            proWorkspaces={stats.proWorkspaces}
          />
        </div>
        <RecentActivity logs={auditLogs} />
      </div>
    </>
  );
}
