import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { verifyVisitorToken } from "@/lib/visitor-auth";

/**
 * POST /api/widget/surveys/respond
 *
 * Submit a CSAT or NPS survey response from the widget.
 * Authenticated via visitor token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, rating, comment, type = "CSAT" } = body;

    // Validate rating range
    if (type === "CSAT" && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "CSAT rating must be between 1 and 5" },
        { status: 400 },
      );
    }
    if (type === "NPS" && (rating < 0 || rating > 10)) {
      return NextResponse.json(
        { error: "NPS rating must be between 0 and 10" },
        { status: 400 },
      );
    }

    // Authenticate visitor
    const token = req.headers.get("x-visitor-token");
    if (!token) {
      return NextResponse.json(
        { error: "Visitor token required" },
        { status: 401 },
      );
    }

    const payload = verifyVisitorToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid visitor token" },
        { status: 401 },
      );
    }

    const { visitorId, workspaceId } = payload;

    // Idempotency check: don't allow duplicate responses per conversation
    if (conversationId) {
      const existing = await prisma.surveyResponse.findFirst({
        where: { conversationId, visitorId, type },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "Survey already submitted",
          responseId: existing.id,
        });
      }
    }

    // Get the assignee for per-agent analytics
    let assigneeId: string | null = null;
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { assigneeId: true },
      });
      assigneeId = conversation?.assigneeId ?? null;
    }

    // Create the survey response
    const response = await prisma.surveyResponse.create({
      data: {
        workspaceId,
        conversationId: conversationId ?? null,
        visitorId,
        type,
        rating,
        comment: comment?.trim() || null,
        assigneeId,
      },
    });

    return NextResponse.json({
      success: true,
      responseId: response.id,
    });
  } catch (error) {
    console.error("Survey response error:", error);
    return NextResponse.json(
      { error: "Failed to submit survey response" },
      { status: 500 },
    );
  }
}
