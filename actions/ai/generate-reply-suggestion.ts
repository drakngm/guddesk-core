"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { callClaude } from "@/lib/ai/client";
import { REPLY_SUGGESTION_SYSTEM } from "@/lib/ai/prompts";

export async function generateReplySuggestion(conversationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error" as const, message: "Not authenticated" };
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });

    if (!conversation) {
      return { status: "error" as const, message: "Conversation not found" };
    }

    await requireWorkspaceMember(conversation.workspaceId, session.user.id);

    const messages = await prisma.message.findMany({
      where: { conversationId, type: { in: ["VISITOR", "AGENT"] } },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { type: true, body: true, senderName: true },
    });

    if (messages.length === 0) {
      return { status: "error" as const, message: "No messages to analyze" };
    }

    const conversationText = messages
      .map((m) => `${m.type === "VISITOR" ? "Customer" : "Agent"}: ${m.body}`)
      .join("\n");

    const suggestion = await callClaude({
      workspaceId: conversation.workspaceId,
      feature: "reply_suggestion",
      system: REPLY_SUGGESTION_SYSTEM,
      messages: [{ role: "user", content: conversationText }],
      conversationId,
    });

    if (!suggestion) {
      return { status: "error" as const, message: "AI features require a Pro plan" };
    }

    return { status: "success" as const, suggestion };
  } catch (error) {
    console.error("Generate reply suggestion error:", error);
    return { status: "error" as const, message: "Failed to generate suggestion" };
  }
}
