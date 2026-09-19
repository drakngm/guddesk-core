"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Hash,
  Plug,
  MessageSquare,
  BookOpen,
  MoreHorizontal,
  Unplug,
  Eye,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { adminDisconnectIntegration } from "@/actions/admin/manage-integration";

interface IntegrationRow {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspacePlan: string;
  type: "slack" | "widget" | "help-center";
  id: string;
  details: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationsTableProps {
  integrations: IntegrationRow[];
  stats: {
    totalSlack: number;
    totalWidget: number;
    totalHelpCenter: number;
    totalWorkspaces: number;
  };
}

const typeIcon = {
  slack: Hash,
  widget: MessageSquare,
  "help-center": BookOpen,
};

const typeLabel = {
  slack: "Slack",
  widget: "Chat Widget",
  "help-center": "Help Center",
};

const typeBadgeVariant = {
  slack: "default" as const,
  widget: "secondary" as const,
  "help-center": "outline" as const,
};

export function IntegrationsTable({
  integrations,
  stats,
}: IntegrationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnectDialog, setDisconnectDialog] = useState<IntegrationRow | null>(null);
  const [loading, setLoading] = useState(false);

  const currentSearch = searchParams.get("search") ?? "";
  const currentType = searchParams.get("type") ?? "all";

  function updateFilters(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/integrations?${params.toString()}`);
  }

  async function handleDisconnect() {
    if (!disconnectDialog) return;
    setLoading(true);
    const result = await adminDisconnectIntegration({
      integrationId: disconnectDialog.id,
      type: disconnectDialog.type,
      workspaceId: disconnectDialog.workspaceId,
    });
    setLoading(false);

    if (result.status === "success") {
      toast.success(
        `${typeLabel[disconnectDialog.type]} disconnected from ${disconnectDialog.workspaceName}`,
      );
      setDisconnectDialog(null);
    } else {
      toast.error(result.message ?? "Failed to disconnect");
    }
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Workspaces</div>
          <div className="text-2xl font-bold">{stats.totalWorkspaces}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="size-3" /> Slack
          </div>
          <div className="text-2xl font-bold">{stats.totalSlack}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="size-3" /> Widget
          </div>
          <div className="text-2xl font-bold">{stats.totalWidget}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3" /> Help Center
          </div>
          <div className="text-2xl font-bold">{stats.totalHelpCenter}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const v = e.target.value;
              // Debounce-like: update after typing stops
              const timeout = setTimeout(() => updateFilters("search", v), 400);
              return () => clearTimeout(timeout);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={currentType}
          onValueChange={(v) => updateFilters("type", v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="widget">Chat Widget</SelectItem>
            <SelectItem value="help-center">Help Center</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
              <TableHead className="hidden lg:table-cell">Connected</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No integrations found.
                </TableCell>
              </TableRow>
            ) : (
              integrations.map((integration) => {
                const Icon = typeIcon[integration.type];
                return (
                  <TableRow key={`${integration.type}-${integration.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-md bg-muted font-medium text-sm">
                          {integration.workspaceName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {integration.workspaceName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            /{integration.workspaceSlug}
                          </div>
                        </div>
                        <Badge
                          variant={
                            integration.workspacePlan === "PRO"
                              ? "default"
                              : "secondary"
                          }
                          className="ml-1"
                        >
                          {integration.workspacePlan}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[integration.type]}>
                        <Icon className="mr-1 size-3" />
                        {typeLabel[integration.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="max-w-[300px] text-xs text-muted-foreground">
                        {integration.type === "slack" && (
                          <span>
                            Channel: {integration.details.channelName} &middot;
                            Webhook: {integration.details.webhookUrl}
                          </span>
                        )}
                        {integration.type === "widget" && (
                          <span>
                            Color: {integration.details.primaryColor} &middot;
                            Position: {integration.details.position} &middot;
                            Branding: {integration.details.showBranding ? "Yes" : "No"}
                          </span>
                        )}
                        {integration.type === "help-center" && (
                          <span>
                            Title: {integration.details.title} &middot;
                            Color: {integration.details.primaryColor}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {format(new Date(integration.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/admin/workspaces/${integration.workspaceId}`)
                            }
                          >
                            <Eye className="mr-2 size-4" />
                            View Workspace
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDisconnectDialog(integration)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Unplug className="mr-2 size-4" />
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Disconnect Dialog */}
      <Dialog
        open={!!disconnectDialog}
        onOpenChange={(open) => !open && setDisconnectDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect integration?</DialogTitle>
            <DialogDescription>
              This will disconnect the{" "}
              <strong>{disconnectDialog && typeLabel[disconnectDialog.type]}</strong>{" "}
              integration from{" "}
              <strong>{disconnectDialog?.workspaceName}</strong>. The workspace will need
              to reconfigure it to reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectDialog(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
