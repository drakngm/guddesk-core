import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPusherServer } from "@/lib/pusher-server";
import { verifyVisitorToken } from "@/lib/visitor-auth";

// POST /api/pusher/auth
// Authenticates Pusher private/presence channel subscriptions
export async function POST(req: NextRequest) {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json(
        { error: "Real-time not configured" },
        { status: 503 },
      );
    }

    const body = await req.text();
    const params = new URLSearchParams(body);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 },
      );
    }

    // Visitor channels (from widget). Private (not presence) — the
    // widget only consumes server-fanned events, doesn't need presence
    // membership semantics, and presence channels cost more per Pusher's
    // pricing/limits.
    if (channelName.startsWith("private-visitor-")) {
      const visitorToken = req.headers.get("x-visitor-token");
      if (!visitorToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const payload = verifyVisitorToken(visitorToken);
      if (!payload) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Verify the conversation actually belongs to this visitor.
      // Without this, any valid visitor token could subscribe to another
      // visitor's conversation channel and read their messages.
      const conversationId = channelName.replace("private-visitor-", "");
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { visitorId: true, workspaceId: true },
      });

      if (
        !conversation ||
        conversation.visitorId !== payload.visitorId ||
        conversation.workspaceId !== payload.workspaceId
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    // Agent channels (authenticated users)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Workspace channels
    if (channelName.startsWith("private-workspace-")) {
      const workspaceId = channelName.replace("private-workspace-", "");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: session.user.id },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    // Conversation channels
    if (channelName.startsWith("private-conversation-")) {
      const conversationId = channelName.replace("private-conversation-", "");

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { workspaceId: true },
      });

      if (!conversation) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: conversation.workspaceId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    // Presence conversation channels (collision detection)
    if (channelName.startsWith("presence-conversation-")) {
      const conversationId = channelName.replace("presence-conversation-", "");

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { workspaceId: true },
      });

      if (!conversation) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: conversation.workspaceId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName, {
        user_id: session.user.id,
        user_info: {
          name: session.user.name,
          image: session.user.image,
        },
      });

      return NextResponse.json(authResponse);
    }

    // Presence workspace channels
    if (channelName.startsWith("presence-workspace-")) {
      const workspaceId = channelName.replace("presence-workspace-", "");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: session.user.id },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const authResponse = pusher.authorizeChannel(socketId, channelName, {
        user_id: session.user.id,
        user_info: {
          name: session.user.name,
          image: session.user.image,
          availability: membership.availability,
        },
      });

      return NextResponse.json(authResponse);
    }

    return NextResponse.json({ error: "Unknown channel" }, { status: 403 });
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
