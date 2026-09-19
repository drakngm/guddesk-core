"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Props {
  firstResponseDueAt?: string | Date | null;
  resolutionDueAt?: string | Date | null;
  firstResponseAt?: string | Date | null;
  slaBreachedAt?: string | Date | null;
  status?: string;
}

export function SlaBadge({
  firstResponseDueAt,
  resolutionDueAt,
  firstResponseAt,
  slaBreachedAt,
  status,
}: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === "CLOSED") return null;

  if (slaBreachedAt) {
    return (
      <Badge variant="destructive" className="text-xs">
        SLA Breached
      </Badge>
    );
  }

  const now = Date.now();
  let dueAt: Date | null = null;
  let label = "";

  if (!firstResponseAt && firstResponseDueAt) {
    dueAt = new Date(firstResponseDueAt);
    label = "Response";
  } else if (resolutionDueAt) {
    dueAt = new Date(resolutionDueAt);
    label = "Resolution";
  }

  if (!dueAt) return null;

  const remaining = dueAt.getTime() - now;
  const isBreached = remaining <= 0;

  if (isBreached) {
    const overdue = formatDuration(Math.abs(remaining));
    return (
      <Badge variant="destructive" className="text-xs">
        {label} overdue {overdue}
      </Badge>
    );
  }

  const isWarning = remaining < 15 * 60 * 1000;
  const timeStr = formatDuration(remaining);

  if (isWarning) {
    return (
      <Badge
        variant="outline"
        className="text-xs border-amber-500 text-amber-600 bg-amber-50"
      >
        {label} {timeStr}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-xs border-emerald-500 text-emerald-600 bg-emerald-50"
    >
      {label} {timeStr}
    </Badge>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
