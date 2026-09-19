"use client";

import { useState, useEffect, useCallback } from "react";
import { usePusher, usePusherReconnect } from "./use-pusher";

export interface MessageItem {
  id: string;
  type: "VISITOR" | "AGENT" | "NOTE" | "SYSTEM" | "BOT";
  body: string;
  senderId: string | null;
  senderName: string | null;
  createdAt: string;
  sender: {
    name: string | null;
    image: string | null;
  } | null;
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time new messages
  // Pusher payload is the message object directly (not wrapped in { message })
  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "message:created",
    (data: MessageItem) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    },
  );

  // Status updates
  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "conversation:updated",
    () => {
      // Refetch to get system messages
      fetchMessages();
    },
  );

  // Resync after reconnect — any message:created fired while we were
  // disconnected is gone forever.
  usePusherReconnect(fetchMessages);

  return { messages, isLoading, refetch: fetchMessages };
}
