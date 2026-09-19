"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePusher } from "./use-pusher";
import { getSharedDraft, upsertSharedDraft } from "@/actions/manage-shared-draft";

interface DraftState {
  body: string;
  lastEditedBy: string | null;
  lastEditedByName: string | null;
  updatedAt: Date | null;
}

/**
 * Hook for real-time shared draft collaboration.
 * Loads existing draft, subscribes to updates, and provides debounced save.
 */
export function useSharedDraft(
  conversationId: string | null,
  currentUserId: string | undefined,
) {
  const [draft, setDraft] = useState<DraftState>({
    body: "",
    lastEditedBy: null,
    lastEditedByName: null,
    updatedAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef("");

  // Load draft when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setDraft({ body: "", lastEditedBy: null, lastEditedByName: null, updatedAt: null });
      return;
    }

    setIsLoading(true);
    getSharedDraft(conversationId)
      .then((result) => {
        if (result.status === "success" && result.draft) {
          setDraft({
            body: result.draft.body,
            lastEditedBy: result.draft.lastEditedBy,
            lastEditedByName: result.draft.lastEditedByName,
            updatedAt: result.draft.updatedAt,
          });
          lastSavedRef.current = result.draft.body;
        }
      })
      .finally(() => setIsLoading(false));
  }, [conversationId]);

  // Listen for draft updates from other agents
  const handleDraftUpdated = useCallback(
    (data: { body: string; lastEditedBy: string; lastEditedByName: string; updatedAt: string }) => {
      // Don't overwrite if we were the one who edited
      if (data.lastEditedBy === currentUserId) return;
      setDraft({
        body: data.body,
        lastEditedBy: data.lastEditedBy,
        lastEditedByName: data.lastEditedByName,
        updatedAt: new Date(data.updatedAt),
      });
      lastSavedRef.current = data.body;
    },
    [currentUserId],
  );

  const handleDraftDeleted = useCallback(() => {
    setDraft({ body: "", lastEditedBy: null, lastEditedByName: null, updatedAt: null });
    lastSavedRef.current = "";
  }, []);

  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "draft:updated",
    handleDraftUpdated,
  );

  usePusher(
    conversationId ? `private-conversation-${conversationId}` : null,
    "draft:deleted",
    handleDraftDeleted,
  );

  /**
   * Update the draft body with debounced save (500ms).
   */
  const updateDraft = useCallback(
    (body: string) => {
      setDraft((prev) => ({ ...prev, body }));

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (conversationId && body !== lastSavedRef.current) {
          lastSavedRef.current = body;
          upsertSharedDraft(conversationId, body);
        }
      }, 500);
    },
    [conversationId],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    draft,
    isLoading,
    updateDraft,
    hasDraft: draft.body.length > 0,
  };
}
