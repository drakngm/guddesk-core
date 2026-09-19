"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePusher, usePusherReconnect } from "./use-pusher";

export interface ConversationListItem {
  id: string;
  status: "OPEN" | "SNOOZED" | "CLOSED";
  channel: "WIDGET" | "EMAIL" | "API";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  tags: string[];
  assigneeId: string | null;
  visitor: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  assignee: {
    id: string;
    user: { name: string | null; image: string | null };
  } | null;
  _count: { messages: number };
}

interface UseConversationsOptions {
  workspaceId: string;
  status?: "OPEN" | "SNOOZED" | "CLOSED";
  assigneeId?: string;
}

const PAGE_SIZE = 25;

export function useConversations({
  workspaceId,
  status = "OPEN",
  assigneeId,
}: UseConversationsOptions) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const nextCursorRef = useRef<string | null>(null);

  const fetchConversations = useCallback(async (cursor?: string) => {
    try {
      const params = new URLSearchParams({
        workspaceId,
        status,
        limit: String(PAGE_SIZE),
      });
      if (assigneeId) params.set("assigneeId", assigneeId);
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/inbox/conversations?${params}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();

        if (cursor) {
          // Appending more results
          setConversations((prev) => [...prev, ...data.conversations]);
        } else {
          // Fresh fetch (filter change or refresh)
          setConversations(data.conversations);
        }

        setHasMore(data.hasMore ?? false);
        setTotal(data.total ?? 0);
        nextCursorRef.current = data.nextCursor ?? null;
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, status, assigneeId]);

  // Initial fetch + re-fetch on filter change
  useEffect(() => {
    setIsLoading(true);
    nextCursorRef.current = null;
    fetchConversations();
  }, [fetchConversations]);

  // Load more (append next page)
  const loadMore = useCallback(() => {
    if (nextCursorRef.current) {
      fetchConversations(nextCursorRef.current);
    }
  }, [fetchConversations]);

  // Real-time updates — refresh from the beginning
  const refresh = useCallback(() => {
    nextCursorRef.current = null;
    fetchConversations();
  }, [fetchConversations]);

  usePusher(`private-workspace-${workspaceId}`, "conversation:created", refresh);
  usePusher(`private-workspace-${workspaceId}`, "conversation:updated", refresh);
  usePusher(`private-workspace-${workspaceId}`, "conversation:new-message", refresh);
  usePusher(`private-workspace-${workspaceId}`, "conversations:bulk-updated", refresh);

  // Resync after reconnect — events that fired while disconnected are lost.
  usePusherReconnect(refresh);

  return { conversations, isLoading, hasMore, total, loadMore, refetch: refresh };
}
