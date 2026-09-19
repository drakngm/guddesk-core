"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getWebhookDeliveries,
  getWebhookDeliveryDetail,
  retryWebhookDelivery,
} from "@/actions/manage-webhooks";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icons } from "@/components/shared/icons";
import type { WebhookDeliveryStatus } from "@prisma/client";

interface DeliveryItem {
  id: string;
  event: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  httpStatus: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface DeliveryDetail {
  id: string;
  endpointId: string;
  endpointUrl: string;
  event: string;
  payload: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface Props {
  endpointId: string;
  workspaceId: string;
  initialDeliveries: DeliveryItem[];
  stats: {
    total: number;
    successRate: number;
    failed: number;
    pending: number;
  };
}

const STATUS_FILTERS: { label: string; value: WebhookDeliveryStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Success", value: "SUCCESS" },
  { label: "Failed", value: "FAILED" },
  { label: "Pending", value: "PENDING" },
];

export function WebhookDeliveryLog({
  endpointId,
  workspaceId,
  initialDeliveries,
  stats,
}: Props) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>(initialDeliveries);
  const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | "ALL">("ALL");
  const [cursor, setCursor] = useState<string | null>(
    initialDeliveries.length >= 50 ? initialDeliveries[initialDeliveries.length - 1]?.id ?? null : null,
  );
  const [hasMore, setHasMore] = useState(initialDeliveries.length >= 50);
  const [selectedDetail, setSelectedDetail] = useState<DeliveryDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (filter: WebhookDeliveryStatus | "ALL") => {
    setStatusFilter(filter);
    startTransition(async () => {
      const result = await getWebhookDeliveries(endpointId, workspaceId, {
        status: filter === "ALL" ? undefined : filter,
        limit: 50,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setDeliveries(result.deliveries!);
      setCursor(result.nextCursor ?? null);
      setHasMore(result.hasMore ?? false);
    });
  };

  const handleLoadMore = () => {
    if (!cursor) return;
    startTransition(async () => {
      const result = await getWebhookDeliveries(endpointId, workspaceId, {
        cursor,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 50,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setDeliveries((prev) => [...prev, ...result.deliveries!]);
      setCursor(result.nextCursor ?? null);
      setHasMore(result.hasMore ?? false);
    });
  };

  const handleRowClick = (deliveryId: string) => {
    startTransition(async () => {
      const result = await getWebhookDeliveryDetail(deliveryId, workspaceId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setSelectedDetail(result.delivery as DeliveryDetail);
      setDialogOpen(true);
    });
  };

  const handleRetry = (deliveryId: string) => {
    startTransition(async () => {
      const result = await retryWebhookDelivery(deliveryId, workspaceId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Retry initiated");
      setDialogOpen(false);

      // Refresh the list
      handleFilterChange(statusFilter);
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Deliveries" value={stats.total.toLocaleString()} />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} />
        <StatCard label="Failed" value={stats.failed.toLocaleString()} variant="destructive" />
        <StatCard label="Pending Retries" value={stats.pending.toLocaleString()} variant="outline" />
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b pb-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "ghost"}
            size="sm"
            className="text-xs"
            onClick={() => handleFilterChange(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Delivery table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No deliveries found
                </TableCell>
              </TableRow>
            )}
            {deliveries.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(d.id)}
              >
                <TableCell className="font-mono text-xs">{d.event}</TableCell>
                <TableCell>
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell className="text-xs">
                  {d.httpStatus ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {d.attemptCount}/{d.maxAttempts}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(d.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <Icons.spinner className="mr-1.5 size-3 animate-spin" />
            ) : null}
            Load More
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{selectedDetail?.event}</span>
              {selectedDetail && <StatusBadge status={selectedDetail.status} />}
            </DialogTitle>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">HTTP Status:</span>{" "}
                  <span className="font-medium">{selectedDetail.httpStatus ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  <span className="font-medium">
                    {selectedDetail.durationMs != null ? `${selectedDetail.durationMs}ms` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts:</span>{" "}
                  <span className="font-medium">
                    {selectedDetail.attemptCount}/{selectedDetail.maxAttempts}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  <span className="font-medium">
                    {new Date(selectedDetail.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Error message */}
              {selectedDetail.errorMessage && (
                <div>
                  <p className="mb-1 text-xs font-medium text-destructive">Error</p>
                  <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {selectedDetail.errorMessage}
                  </div>
                </div>
              )}

              {/* Request payload */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Request Payload</p>
                <pre className="max-h-[200px] overflow-auto rounded bg-muted p-3 font-mono text-xs">
                  {formatJson(selectedDetail.payload)}
                </pre>
              </div>

              {/* Response body */}
              {selectedDetail.responseBody && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Response Body</p>
                  <pre className="max-h-[200px] overflow-auto rounded bg-muted p-3 font-mono text-xs">
                    {formatJson(selectedDetail.responseBody)}
                  </pre>
                </div>
              )}

              {/* Retry button for failed/pending */}
              {selectedDetail.status !== "SUCCESS" && (
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleRetry(selectedDetail.id)}
                    disabled={isPending}
                  >
                    {isPending && <Icons.spinner className="mr-1.5 size-3 animate-spin" />}
                    Retry Now
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper components ───────────────────────────

function StatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  switch (status) {
    case "SUCCESS":
      return <Badge variant="default" className="bg-green-600 text-[10px]">Success</Badge>;
    case "FAILED":
      return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
    case "PENDING":
      return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
  }
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "destructive" | "outline";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold ${
          variant === "destructive"
            ? "text-destructive"
            : variant === "outline"
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
