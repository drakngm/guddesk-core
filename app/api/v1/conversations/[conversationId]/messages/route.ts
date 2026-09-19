import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { safeTriggerBatch } from "@/lib/pusher-server";
import {
  withApiAuth,
  withHeaders,
  apiOk,
  apiError,
  parsePagination,
  prismaPagination,
  buildPaginationResult,
} from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/conversations/:conversationId/messages  —  List messages
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    // Verify conversation belongs to workspace
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });

    if (!conversation || conversation.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Conversation not found", 404), rateLimitHeaders);
    }

    const pagination = parsePagination(req);

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        select: {
          id: true,
          type: true,
          body: true,
          senderId: true,
          senderName: true,
          attachments: true,
          createdAt: true,
          sender: {
            select: { name: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
        ...prismaPagination(pagination),
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    const { items, meta } = buildPaginationResult(messages, pagination, total);

    return withHeaders(apiOk(items, meta), rateLimitHeaders);
  } catch (error) {
    console.error("List messages error:", error);
    return withHeaders(apiError("Failed to list messages", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/conversations/:conversationId/messages  —  Send a message
// Body: { body, type?, senderName? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    // Verify conversation belongs to workspace
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });

    if (!conversation || conversation.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Conversation not found", 404), rateLimitHeaders);
    }

    const body = await req.json();
    const { body: messageBody, type, senderName } = body;

    if (!messageBody || typeof messageBody !== "string" || !messageBody.trim()) {
      return withHeaders(
        apiError("body is required and must be a non-empty string", 400),
        rateLimitHeaders,
      );
    }

    // Only allow BOT and AGENT types via API (VISITOR messages come from widget)
    const messageType = type === "AGENT" ? "AGENT" : "BOT";

    const message = await prisma.message.create({
      data: {
        conversationId,
        type: messageType,
        body: messageBody.trim(),
        senderName: typeof senderName === "string" ? senderName : undefined,
      },
      select: {
        id: true,
        type: true,
        body: true,
        senderName: true,
        createdAt: true,
      },
    });

    // Update conversation metadata
    const preview =
      messageBody.length > 100
        ? messageBody.slice(0, 100) + "..."
        : messageBody;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      },
    });

    // Trigger real-time events — batched and awaited so they actually
    // reach Pusher under Vercel serverless (fire-and-forget work after
    // the response is killed when the function freezes).
    const payload = {
      id: message.id,
      type: message.type,
      body: message.body,
      senderId: null,
      senderName: message.senderName,
      createdAt: message.createdAt,
    };
    await safeTriggerBatch(
      [
        { channel: `private-visitor-${conversationId}`, name: "message:created", data: payload },
        { channel: `private-conversation-${conversationId}`, name: "message:created", data: payload },
        {
          channel: `private-workspace-${ctx.workspaceId}`,
          name: "conversation:new-message",
          data: {
            conversationId,
            lastMessageAt: new Date(),
            lastMessagePreview: preview,
          },
        },
      ],
      "POST /api/v1/conversations/[id]/messages",
    );

    return withHeaders(apiOk(message, undefined, 201), rateLimitHeaders);
  } catch (error) {
    console.error("Send message error:", error);
    return withHeaders(apiError("Failed to send message", 500), rateLimitHeaders);
  }
}
