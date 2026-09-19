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

interface TopWorkspace {
  id: string;
  name: string;
  slug: string;
  plan: "FREE" | "PRO";
  _count: { conversations: number; members: number };
}

export function TopWorkspacesTable({ workspaces }: { workspaces: TopWorkspace[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Workspaces</CardTitle>
        <CardDescription>
          Most active workspaces by conversations this month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspace activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden sm:table-cell">Members</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{workspace.name}</div>
                      <div className="text-sm text-muted-foreground">
                        /{workspace.slug}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={workspace.plan === "PRO" ? "default" : "secondary"}
                    >
                      {workspace.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {workspace._count.members}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {workspace._count.conversations}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
