"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { callClaude } from "@/lib/ai/client";
import { SUMMARIZE_SYSTEM } from "@/lib/ai/prompts";

export async function summarizeConversation(conversationId: string) {
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
      take: 30,
      select: { type: true, body: true },
    });

    const conversationText = messages
      .map((m) => `${m.type === "VISITOR" ? "Customer" : "Agent"}: ${m.body}`)
      .join("\n");

    const summary = await callClaude({
      workspaceId: conversation.workspaceId,
      feature: "summarize",
      system: SUMMARIZE_SYSTEM,
      messages: [{ role: "user", content: conversationText }],
      maxTokens: 256,
      conversationId,
    });

    if (!summary) {
      return { status: "error" as const, message: "AI features require a Pro plan" };
    }

    // Save to conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiSummary: summary },
    });

    return { status: "success" as const, summary };
  } catch (error) {
    console.error("Summarize conversation error:", error);
    return { status: "error" as const, message: "Failed to summarize" };
  }
}
