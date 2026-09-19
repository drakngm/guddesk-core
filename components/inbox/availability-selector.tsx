"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAvailability } from "@/actions/update-agent-availability";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentAvailability } from "@prisma/client";

interface Props {
  workspaceId: string;
  initialStatus?: AgentAvailability;
}

const statusConfig: Record<AgentAvailability, { label: string; color: string }> = {
  ONLINE: { label: "Online", color: "bg-green-500" },
  AWAY: { label: "Away", color: "bg-yellow-500" },
  OFFLINE: { label: "Offline", color: "bg-gray-400" },
};

export function AvailabilitySelector({ workspaceId, initialStatus = "OFFLINE" }: Props) {
  const [currentStatus, setCurrentStatus] = useState<AgentAvailability>(initialStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const status = value as AgentAvailability;
    setCurrentStatus(status);
    startTransition(async () => {
      const result = await updateAvailability(workspaceId, status);
      if (result.status === "error") {
        toast.error(result.message);
      }
    });
  }

  const config = statusConfig[currentStatus];

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-7 w-[110px] text-xs">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${config.color}`} />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(statusConfig) as [AgentAvailability, typeof config][]).map(([key, cfg]) => (
          <SelectItem key={key} value={key}>
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${cfg.color}`} />
              {cfg.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
