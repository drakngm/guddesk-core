"use client";

import { useState, useCallback, useRef } from "react";
import { usePusher } from "./use-pusher";
import { sendTypingIndicator } from "@/actions/send-typing";

export function useTypingIndicator(conversationId: string | null) {
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<number>(0);

  // Listen for typing events from other agents
  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "typing:start",
    (data: { userId: string; name: string }) => {
      setIsTyping(true);
      setTypingUser(data.name);

      // Auto-clear after 3 seconds
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setTypingUser(null);
      }, 3000);
    },
  );

  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "typing:stop",
    () => {
      setIsTyping(false);
      setTypingUser(null);
    },
  );

  // Send typing indicator to both agent dashboard and visitor widget
  // via server action (fires Pusher on both channels)
  const sendTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    // Throttle: one call per 2 seconds (server action has more overhead than client events)
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;

    // Fire-and-forget — don't await, we don't want to block typing UX
    void sendTypingIndicator(conversationId, true);
  }, [conversationId]);

  return { isTyping, typingUser, sendTyping };
}
