import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { withApiAuth, withHeaders, apiOk, apiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/segments/:segmentId  —  Get a segment
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;

  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const segment = await prisma.customerSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment || segment.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Segment not found", 404), rateLimitHeaders);
    }

    return withHeaders(apiOk(segment), rateLimitHeaders);
  } catch (error) {
    console.error("Get segment error:", error);
    return withHeaders(apiError("Failed to get segment", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/segments/:segmentId  —  Update a segment
// Body: { name?, description?, conditions?, color? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;

  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const existing = await prisma.customerSegment.findUnique({
      where: { id: segmentId },
      select: { workspaceId: true },
    });

    if (!existing || existing.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Segment not found", 404), rateLimitHeaders);
    }

    const body = await req.json();
    const { name, description, conditions, color } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : name;
    if (description !== undefined) updateData.description = typeof description === "string" ? description.trim() : null;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (color !== undefined) updateData.color = color;

    if (Object.keys(updateData).length === 0) {
      return withHeaders(apiError("No fields to update", 400), rateLimitHeaders);
    }

    const updated = await prisma.customerSegment.update({
      where: { id: segmentId },
      data: updateData,
    });

    return withHeaders(apiOk(updated), rateLimitHeaders);
  } catch (error) {
    console.error("Update segment error:", error);
    return withHeaders(apiError("Failed to update segment", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/segments/:segmentId  —  Delete a segment
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;

  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const existing = await prisma.customerSegment.findUnique({
      where: { id: segmentId },
      select: { workspaceId: true },
    });

    if (!existing || existing.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Segment not found", 404), rateLimitHeaders);
    }

    await prisma.customerSegment.delete({ where: { id: segmentId } });

    return withHeaders(apiOk({ deleted: true }), rateLimitHeaders);
  } catch (error) {
    console.error("Delete segment error:", error);
    return withHeaders(apiError("Failed to delete segment", 500), rateLimitHeaders);
  }
}
