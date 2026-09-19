import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building,
  Calendar,
  Key,
  MessageSquare,
  Users,
  Cpu,
  Eye,
} from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceDetail } from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard/header";
import { WorkspaceActionsDropdown } from "@/components/admin/workspace-actions-dropdown";

export const metadata = constructMetadata({
  title: "Workspace Detail – Admin – GudDesk",
  description: "Workspace details and management.",
});

interface WorkspaceDetailPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function AdminWorkspaceDetailPage({
  params,
}: WorkspaceDetailPageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const { workspaceId } = await params;
  const workspace = await getWorkspaceDetail(workspaceId);

  if (!workspace) notFound();

  return (
    <>
      <DashboardHeader heading="Workspace Detail" text={workspace.name}>
        <div className="flex gap-2">
          <Link href="/admin/workspaces">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
          </Link>
          <WorkspaceActionsDropdown
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            currentPlan={workspace.plan}
          />
        </div>
      </DashboardHeader>

      <div className="flex flex-col gap-5">
        {/* Workspace Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarImage src={workspace.logo ?? undefined} />
                <AvatarFallback className="text-lg">
                  {workspace.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {workspace.name}
                  <Badge variant={workspace.plan === "PRO" ? "default" : "secondary"}>
                    {workspace.plan}
                  </Badge>
                </CardTitle>
                <CardDescription>/{workspace.slug}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                Created {format(new Date(workspace.createdAt), "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Key className="size-4" />
                <span className="truncate font-mono text-xs">gd_pub_{workspace.appId}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="size-4" />
                Slack: {workspace.slackIntegration ? "Connected" : "Not connected"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="size-4" />
                Widget: {workspace.widgetSettings ? "Configured" : "Not set up"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Conversations (month)
              </CardTitle>
              <MessageSquare className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workspace.usage.conversationsThisMonth.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workspace.usage.totalMessages.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workspace.usage.totalVisitors.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Tokens Used</CardTitle>
              <Cpu className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workspace.usage.totalAiTokens.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Members ({workspace.members.length})</CardTitle>
            <CardDescription>Workspace members and their roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={member.user.image ?? undefined} />
                          <AvatarFallback>
                            {(member.user.name ?? member.user.email ?? "?")
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.user.name ?? "—"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(member.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
