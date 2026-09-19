"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { safeTriggerBatch } from "@/lib/pusher-server";

/**
 * Send a typing indicator to both the agent dashboard and the visitor widget.
 * Called by the reply box when the agent types.
 */
export async function sendTypingIndicator(
  conversationId: string,
  typing: boolean,
) {
  const session = await auth();
  if (!session?.user?.id) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { workspaceId: true },
  });
  if (!conversation) return;

  const event = typing ? "typing:start" : "typing:stop";
  const data = { userId: session.user.id, name: session.user.name ?? "Agent" };

  // Fire on both channels so the widget AND other agents see it
  await safeTriggerBatch(
    [
      { channel: `private-conversation-${conversationId}`, name: event, data },
      { channel: `private-visitor-${conversationId}`, name: event, data },
    ],
    "sendTypingIndicator",
  );
}
