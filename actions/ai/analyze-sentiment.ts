"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { callClaude } from "@/lib/ai/client";
import { SENTIMENT_SYSTEM } from "@/lib/ai/prompts";

export async function analyzeSentiment(conversationId: string) {
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
      where: { conversationId, type: "VISITOR" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { body: true },
    });

    const customerMessages = messages.map((m) => m.body).join("\n");

    const result = await callClaude({
      workspaceId: conversation.workspaceId,
      feature: "sentiment",
      system: SENTIMENT_SYSTEM,
      messages: [{ role: "user", content: customerMessages }],
      maxTokens: 16,
      conversationId,
    });

    if (!result) {
      return { status: "error" as const, message: "AI features require a Pro plan" };
    }

    const sentiment = result.trim().toLowerCase();
    const valid = ["positive", "neutral", "negative", "frustrated"];
    const normalizedSentiment = valid.includes(sentiment) ? sentiment : "neutral";

    return { status: "success" as const, sentiment: normalizedSentiment };
  } catch (error) {
    console.error("Analyze sentiment error:", error);
    return { status: "error" as const, message: "Failed to analyze sentiment" };
  }
}
