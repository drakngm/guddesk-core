import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { safeTriggerBatch } from "@/lib/pusher-server";
import { EmailChannelProvider } from "@/lib/channels/email/provider";

const emailProvider = new EmailChannelProvider();

// POST /api/email/inbound
// Handles inbound emails from Resend webhook.
//
// Two modes:
// 1. reply+{conversationId}@mail.guddesk.com  — Agent replying by email to a notification
// 2. support+{appId}@mail.guddesk.com         — Customer emailing support (new or threaded)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Resend inbound webhook payload
    const { from, to, subject, text, headers: emailHeaders } = body;

    if (!from || !to || !text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const toAddress = Array.isArray(to) ? to[0] : to;

    // Extract sender email from "Name <email@domain>" format
    const fromEmail =
      typeof from === "string"
        ? from.match(/<(.+)>/)?.[1] ?? from
        : from;

    const fromName =
      typeof from === "string"
        ? from.match(/^(.+?)\s*</)?.[1]?.replace(/"/g, "").trim() ?? undefined
        : undefined;

    // ──────────────────────────────────────────────────────────
    // Mode 1: Agent reply-by-email (reply+{conversationId}@...)
    // ──────────────────────────────────────────────────────────
    const replyMatch = toAddress.match(/reply\+([a-z0-9]+)@/i);

    if (replyMatch) {
      return handleAgentReply(replyMatch[1], fromEmail, text);
    }

    // ──────────────────────────────────────────────────────────
    // Mode 2: Customer email (support+{appId}@...)
    // ──────────────────────────────────────────────────────────
    const supportMatch = toAddress.match(/support\+([a-z0-9]+)@/i);

    if (supportMatch) {
      return handleCustomerEmail(
        supportMatch[1],
        fromEmail,
        fromName,
        subject,
        text,
        emailHeaders,
      );
    }

    return NextResponse.json(
      { error: "Unrecognized recipient address" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Inbound email error:", error);
    return NextResponse.json(
      { error: "Failed to process inbound email" },
      { status: 500 },
    );
  }
}

// ── Mode 1: Agent replying to notification email ─────────────

async function handleAgentReply(
  conversationId: string,
  fromEmail: string,
  text: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, workspaceId: true, status: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // Verify sender is a workspace member
  const user = await prisma.user.findUnique({
    where: { email: fromEmail },
    select: { id: true, name: true },
  });

  if (user) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: conversation.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a workspace member" },
        { status: 403 },
      );
    }
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      conversationId,
      type: user ? "AGENT" : "VISITOR",
      body: text.trim(),
      senderId: user?.id,
      senderName: user?.name ?? fromEmail,
    },
  });

  // Track first agent response for SLA
  if (user) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { firstResponseAt: true },
    });
    if (conv && !conv.firstResponseAt) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { firstResponseAt: new Date() },
      });
    }
  }

  // Reopen if closed
  const preview = text.trim().slice(0, 200);
  if (conversation.status === "CLOSED") {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: "OPEN",
        closedAt: null,
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      },
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      },
    });
  }

  // Broadcast via Pusher
  await safeTriggerBatch(
    [
      {
        channel: `private-conversation-${conversationId}`,
        name: "message:created",
        data: {
          id: message.id,
          conversationId,
          type: message.type,
          body: message.body,
          senderName: message.senderName,
          createdAt: message.createdAt,
        },
      },
      {
        channel: `private-workspace-${conversation.workspaceId}`,
        name: "conversation:updated",
        data: { conversationId },
      },
    ],
    "email.inbound",
  );

  return NextResponse.json({ success: true, messageId: message.id });
}

// ── Mode 2: Customer emailing support ────────────────────────

async function handleCustomerEmail(
  appId: string,
  fromEmail: string,
  fromName: string | undefined,
  subject: string | undefined,
  text: string,
  emailHeaders: Record<string, string> | undefined,
) {
  // Look up workspace by appId
  const workspace = await prisma.workspace.findUnique({
    where: { appId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Invalid App ID" },
      { status: 401 },
    );
  }

  // Check if email channel is enabled
  const config = await prisma.emailChannelConfig.findUnique({
    where: { workspaceId: workspace.id },
    select: { isEnabled: true },
  });

  if (!config?.isEnabled) {
    return NextResponse.json(
      { error: "Email channel not enabled" },
      { status: 403 },
    );
  }

  // Try to find existing conversation via In-Reply-To or References headers
  let threadId: string | undefined;
  const inReplyTo = emailHeaders?.["in-reply-to"] ?? emailHeaders?.["In-Reply-To"];

  if (inReplyTo) {
    // Check if In-Reply-To matches a message we sent
    const referencedMessage = await prisma.message.findFirst({
      where: { emailMessageId: inReplyTo },
      select: { conversationId: true },
    });

    if (referencedMessage) {
      threadId = referencedMessage.conversationId;
    }
  }

  // Also check References header for known message IDs
  if (!threadId) {
    const references = emailHeaders?.["references"] ?? emailHeaders?.["References"];
    if (references) {
      const refIds = references.split(/\s+/).filter(Boolean);

      // Check for thread-{conversationId}@ pattern
      for (const ref of refIds) {
        const threadMatch = ref.match(/thread-([a-z0-9]+)@/i);
        if (threadMatch) {
          const exists = await prisma.conversation.findFirst({
            where: { id: threadMatch[1], workspaceId: workspace.id },
            select: { id: true },
          });
          if (exists) {
            threadId = exists.id;
            break;
          }
        }
      }

      // Fall back to checking individual message IDs
      if (!threadId) {
        for (const ref of refIds) {
          const msg = await prisma.message.findFirst({
            where: { emailMessageId: ref },
            select: { conversationId: true },
          });
          if (msg) {
            threadId = msg.conversationId;
            break;
          }
        }
      }
    }
  }

  // Use the email channel provider to handle the inbound email
  const result = await emailProvider.handleInbound({
    workspaceId: workspace.id,
    from: fromEmail,
    fromName,
    subject,
    body: text.trim(),
    threadId,
  });

  return NextResponse.json({
    success: true,
    conversationId: result.conversationId,
    messageId: result.messageId,
    isNew: result.isNew,
  });
}
