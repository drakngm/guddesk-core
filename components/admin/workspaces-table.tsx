"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceActionsDropdown } from "@/components/admin/workspace-actions-dropdown";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: "FREE" | "PRO";
  createdAt: Date;
  _count: { members: number; conversations: number };
}

interface WorkspacesTableProps {
  workspaces: WorkspaceRow[];
  total: number;
  totalPages: number;
  page: number;
}

export function WorkspacesTable({ workspaces, total, totalPages, page }: WorkspacesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.delete("page");
    router.push(`/admin/workspaces?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name or slug..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => {
            const timeout = setTimeout(
              () => updateParams("search", e.target.value),
              300,
            );
            return () => clearTimeout(timeout);
          }}
          className="sm:max-w-xs"
        />
        <Select
          defaultValue={searchParams.get("plan") ?? "all"}
          onValueChange={(v) => updateParams("plan", v)}
        >
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {total} workspace{total !== 1 ? "s" : ""} found
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden md:table-cell">Members</TableHead>
              <TableHead className="hidden md:table-cell">Conversations</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No workspaces found.
                </TableCell>
              </TableRow>
            ) : (
              workspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={workspace.logo ?? undefined} />
                        <AvatarFallback>
                          {workspace.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{workspace.name}</div>
                        <div className="text-sm text-muted-foreground">
                          /{workspace.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={workspace.plan === "PRO" ? "default" : "secondary"}>
                      {workspace.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {workspace._count.members}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {workspace._count.conversations}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {format(new Date(workspace.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <WorkspaceActionsDropdown
                      workspaceId={workspace.id}
                      workspaceName={workspace.name}
                      currentPlan={workspace.plan}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams("page", String(page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams("page", String(page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
