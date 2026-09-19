"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { safeTrigger } from "@/lib/pusher-server";
import { requireWorkspaceMember } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function createSideConversation(
  conversationId: string,
  data: { subject: string; participantIds: string[] },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    if (!conversation) throw new Error("Conversation not found");

    await requireWorkspaceMember(conversation.workspaceId, session.user.id);

    if (!data.subject.trim()) {
      return { status: "error" as const, message: "Subject is required" };
    }

    // Ensure creator is in participant list
    const participantIds = data.participantIds.includes(session.user.id)
      ? data.participantIds
      : [session.user.id, ...data.participantIds];

    const sideConversation = await prisma.sideConversation.create({
      data: {
        workspaceId: conversation.workspaceId,
        conversationId,
        subject: data.subject.trim(),
        createdById: session.user.id,
        participantIds,
      },
    });

    // Broadcast to conversation channel
    await safeTrigger(
      `private-conversation-${conversationId}`,
      "side-conversation:created",
      {
        id: sideConversation.id,
        subject: sideConversation.subject,
        createdById: session.user.id,
        createdByName: session.user.name,
        participantIds,
      },
      "createSideConversation",
    );

    revalidatePath("/workspace");
    return { status: "success" as const, sideConversationId: sideConversation.id };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error" as const, message: error.message };
    }
    return { status: "error" as const, message: "Failed to create side conversation" };
  }
}

export async function sendSideMessage(
  sideConversationId: string,
  body: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (!body.trim()) {
      return { status: "error" as const, message: "Message cannot be empty" };
    }

    const sideConv = await prisma.sideConversation.findUnique({
      where: { id: sideConversationId },
      select: { conversationId: true, workspaceId: true, participantIds: true },
    });
    if (!sideConv) throw new Error("Side conversation not found");

    await requireWorkspaceMember(sideConv.workspaceId, session.user.id);

    const message = await prisma.sideConversationMessage.create({
      data: {
        sideConversationId,
        senderId: session.user.id,
        senderName: session.user.name ?? "Agent",
        body: body.trim(),
      },
    });

    // Update the side conversation timestamp
    await prisma.sideConversation.update({
      where: { id: sideConversationId },
      data: { updatedAt: new Date() },
    });

    // Broadcast the message
    await safeTrigger(
      `private-conversation-${sideConv.conversationId}`,
      "side-conversation:message",
      {
        sideConversationId,
        message: {
          id: message.id,
          senderId: message.senderId,
          senderName: message.senderName,
          body: message.body,
          createdAt: message.createdAt,
        },
      },
      "sendSideMessage",
    );

    return { status: "success" as const, messageId: message.id };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error" as const, message: error.message };
    }
    return { status: "error" as const, message: "Failed to send message" };
  }
}

export async function closeSideConversation(sideConversationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const sideConv = await prisma.sideConversation.findUnique({
      where: { id: sideConversationId },
      select: { conversationId: true, workspaceId: true },
    });
    if (!sideConv) throw new Error("Side conversation not found");

    await requireWorkspaceMember(sideConv.workspaceId, session.user.id);

    await prisma.sideConversation.update({
      where: { id: sideConversationId },
      data: { status: "CLOSED" },
    });

    await safeTrigger(
      `private-conversation-${sideConv.conversationId}`,
      "side-conversation:closed",
      { sideConversationId },
      "closeSideConversation",
    );

    revalidatePath("/workspace");
    return { status: "success" as const };
  } catch (error) {
    return { status: "error" as const, message: "Failed to close side conversation" };
  }
}
