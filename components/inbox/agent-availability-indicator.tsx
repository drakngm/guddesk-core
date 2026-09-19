"use client";

import { cn } from "@/lib/utils";

type Availability = "ONLINE" | "AWAY" | "OFFLINE";

interface Props {
  availability: Availability;
  className?: string;
}

const colors: Record<Availability, string> = {
  ONLINE: "bg-green-500",
  AWAY: "bg-yellow-500",
  OFFLINE: "bg-gray-400",
};

const labels: Record<Availability, string> = {
  ONLINE: "Online",
  AWAY: "Away",
  OFFLINE: "Offline",
};

export function AgentAvailabilityIndicator({ availability, className }: Props) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", colors[availability], className)}
      title={labels[availability]}
    />
  );
}
