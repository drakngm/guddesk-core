import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
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

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  createdAt: Date;
  admin: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ban_user: { label: "Banned User", variant: "destructive" },
  unban_user: { label: "Unbanned User", variant: "secondary" },
  change_plan: { label: "Changed Plan", variant: "default" },
  delete_team: { label: "Deleted Workspace", variant: "destructive" },
  change_role: { label: "Changed Role", variant: "outline" },
};

export function RecentActivity({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Admin actions audit log</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No admin actions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Admin actions audit log</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] ?? {
                label: log.action,
                variant: "outline" as const,
              };
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.admin.name ?? log.admin.email ?? "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.targetType === "TEAM" && log.metadata?.workspaceName
                      ? log.metadata.workspaceName
                      : `${log.targetType}:${log.targetId.slice(0, 8)}...`}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
