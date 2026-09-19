"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { safeTrigger } from "@/lib/pusher-server";
import { requireWorkspaceMember } from "@/lib/workspace";

export async function upsertSharedDraft(
  conversationId: string,
  body: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!conversation) throw new Error("Conversation not found");

    await requireWorkspaceMember(conversation.workspaceId, session.user.id);

    const draft = await prisma.sharedDraft.upsert({
      where: { conversationId },
      create: {
        conversationId,
        body,
        lastEditedBy: session.user.id,
      },
      update: {
        body,
        lastEditedBy: session.user.id,
      },
    });

    // Broadcast draft update to other agents viewing this conversation
    await safeTrigger(
      `private-conversation-${conversationId}`,
      "draft:updated",
      {
        conversationId,
        body,
        lastEditedBy: session.user.id,
        lastEditedByName: session.user.name ?? "Agent",
        updatedAt: draft.updatedAt,
      },
      "upsertSharedDraft",
    );

    return { status: "success" as const };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error" as const, message: error.message };
    }
    return { status: "error" as const, message: "Failed to save draft" };
  }
}

export async function deleteSharedDraft(conversationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!conversation) throw new Error("Conversation not found");

    await requireWorkspaceMember(conversation.workspaceId, session.user.id);

    await prisma.sharedDraft.deleteMany({
      where: { conversationId },
    });

    await safeTrigger(
      `private-conversation-${conversationId}`,
      "draft:deleted",
      { conversationId },
      "deleteSharedDraft",
    );

    return { status: "success" as const };
  } catch (error) {
    return { status: "error" as const, message: "Failed to delete draft" };
  }
}

export async function getSharedDraft(conversationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!conversation) throw new Error("Conversation not found");

    await requireWorkspaceMember(conversation.workspaceId, session.user.id);

    const draft = await prisma.sharedDraft.findUnique({
      where: { conversationId },
    });

    if (!draft) return { status: "success" as const, draft: null };

    // Resolve editor name
    let editorName: string | null = null;
    if (draft.lastEditedBy) {
      const editor = await prisma.user.findUnique({
        where: { id: draft.lastEditedBy },
        select: { name: true },
      });
      editorName = editor?.name ?? null;
    }

    return {
      status: "success" as const,
      draft: {
        body: draft.body,
        lastEditedBy: draft.lastEditedBy,
        lastEditedByName: editorName,
        updatedAt: draft.updatedAt,
      },
    };
  } catch (error) {
    return { status: "error" as const, message: "Failed to load draft", draft: null };
  }
}
