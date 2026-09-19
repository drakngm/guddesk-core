"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/workspace";
import { callClaude } from "@/lib/ai/client";
import { SUGGEST_ARTICLES_SYSTEM } from "@/lib/ai/prompts";

export async function suggestArticles(conversationId: string) {
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

    const [messages, articles] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId, type: "VISITOR" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { body: true },
      }),
      prisma.article.findMany({
        where: { workspaceId: conversation.workspaceId, isPublished: true },
        select: { id: true, title: true, excerpt: true },
        take: 50,
      }),
    ]);

    if (articles.length === 0) {
      return { status: "success" as const, articles: [] };
    }

    const customerMessages = messages.map((m) => m.body).join("\n");
    const articleList = articles
      .map((a) => `ID: ${a.id} | Title: ${a.title} | Excerpt: ${a.excerpt ?? ""}`)
      .join("\n");

    const result = await callClaude({
      workspaceId: conversation.workspaceId,
      feature: "suggest_articles",
      system: SUGGEST_ARTICLES_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Customer messages:\n${customerMessages}\n\nAvailable articles:\n${articleList}`,
        },
      ],
      maxTokens: 256,
      conversationId,
    });

    if (!result) {
      return { status: "error" as const, message: "AI features require a Pro plan" };
    }

    let articleIds: string[] = [];
    try {
      articleIds = JSON.parse(result);
      if (!Array.isArray(articleIds)) articleIds = [];
    } catch {
      articleIds = [];
    }

    const suggested = articles.filter((a) => articleIds.includes(a.id));

    return { status: "success" as const, articles: suggested };
  } catch (error) {
    console.error("Suggest articles error:", error);
    return { status: "error" as const, message: "Failed to suggest articles" };
  }
}
