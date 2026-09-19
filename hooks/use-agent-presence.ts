"use client";

import { useState, useEffect, useCallback } from "react";
import { usePusher } from "./use-pusher";

export interface AgentStatus {
  memberId: string;
  userId: string;
  availability: "ONLINE" | "AWAY" | "OFFLINE";
}

/**
 * Track agent availability across the workspace in real-time.
 * Listens for `agent:availability-changed` events on the workspace channel.
 */
export function useAgentPresence(workspaceId: string) {
  const [agentStatuses, setAgentStatuses] = useState<Map<string, AgentStatus>>(new Map());

  const handleAvailabilityChanged = useCallback(
    (data: AgentStatus) => {
      setAgentStatuses((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data);
        return next;
      });
    },
    [],
  );

  usePusher(
    `private-workspace-${workspaceId}`,
    "agent:availability-changed",
    handleAvailabilityChanged,
  );

  /**
   * Get the availability for a specific user.
   */
  function getAvailability(userId: string): "ONLINE" | "AWAY" | "OFFLINE" {
    return agentStatuses.get(userId)?.availability ?? "OFFLINE";
  }

  return { agentStatuses, getAvailability };
}
