"use client";

import { useState, useCallback, useMemo } from "react";

interface Member {
  id: string;
  userId: string;
  user: { name: string | null; image: string | null };
}

/**
 * Hook for @mention detection in textarea.
 *
 * Usage:
 * 1. Call `handleInputChange(value, cursorPosition)` on every keystroke
 * 2. When `showPicker` is true, render the mention picker with `filteredMembers`
 * 3. Call `insertMention(member)` to insert @Name at cursor
 */
export function useMentions(members: Member[]) {
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]); // userId[]

  const filteredMembers = useMemo(() => {
    if (!query) return members;
    const lower = query.toLowerCase();
    return members.filter((m) =>
      m.user.name?.toLowerCase().includes(lower),
    );
  }, [query, members]);

  /**
   * Call on every input change to detect @mention triggers.
   */
  const handleInputChange = useCallback(
    (value: string, cursorPos: number) => {
      // Look backward from cursor for an @ that starts a mention
      const textBefore = value.slice(0, cursorPos);
      const lastAt = textBefore.lastIndexOf("@");

      if (lastAt === -1) {
        setShowPicker(false);
        return;
      }

      // Check that @ is at start of input or preceded by whitespace
      if (lastAt > 0 && !/\s/.test(textBefore[lastAt - 1])) {
        setShowPicker(false);
        return;
      }

      const mentionQuery = textBefore.slice(lastAt + 1);

      // Don't show picker if there's a space in the query (mention is complete)
      if (mentionQuery.includes(" ") && mentionQuery.length > 20) {
        setShowPicker(false);
        return;
      }

      setMentionStart(lastAt);
      setQuery(mentionQuery);
      setShowPicker(true);
    },
    [],
  );

  /**
   * Insert a mention. Returns the new text value and the updated userId list.
   */
  const insertMention = useCallback(
    (member: Member, currentValue: string, cursorPos: number): { newValue: string; newCursorPos: number } => {
      const name = member.user.name ?? "Unknown";
      const before = currentValue.slice(0, mentionStart);
      const after = currentValue.slice(cursorPos);
      const newValue = `${before}@${name} ${after}`;
      const newCursorPos = mentionStart + name.length + 2; // +2 for @ and space

      setSelectedMentions((prev) =>
        prev.includes(member.userId) ? prev : [...prev, member.userId],
      );
      setShowPicker(false);
      setQuery("");

      return { newValue, newCursorPos };
    },
    [mentionStart],
  );

  const closePicker = useCallback(() => {
    setShowPicker(false);
    setQuery("");
  }, []);

  const resetMentions = useCallback(() => {
    setSelectedMentions([]);
    setShowPicker(false);
    setQuery("");
  }, []);

  return {
    showPicker,
    query,
    filteredMembers,
    selectedMentions,
    handleInputChange,
    insertMention,
    closePicker,
    resetMentions,
  };
}
